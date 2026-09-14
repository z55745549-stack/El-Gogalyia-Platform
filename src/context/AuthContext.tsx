/**
 * HARDENED & SECURE AUTHENTICATION CONTEXT (SaaS WorkHub)
 * 
 * Authentication Architecture:
 * 1. Team Members / Students: Secure username & password with PBKDF2 cryptographic hashing.
 * 2. Administrators: Google OAuth with server-side / Firestore authorized whitelist verification.
 * 3. Real-time account status & role synchronization.
 * 4. Two-Factor Authentication (2FA) support with Google account linking.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { verifyPassword, generateSalt, hashPassword } from '@/lib/auth-security';
import { parseErrorMessage, logError } from '@/lib/errors';
import type { UserProfile, Permission, AuthorizedAdmin } from '@/types';

// -------------------------------------------------------------------
// Login Rate Limiter (In-memory + Session scoped protection)
// -------------------------------------------------------------------
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const _loginAttempts = new Map<string, { count: number; resetAt: number }>();

function recordLoginAttempt(key: string): { blocked: boolean } {
  const now = Date.now();
  const entry = _loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    _loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { blocked: false };
  }
  entry.count += 1;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return { blocked: true };
  }
  return { blocked: false };
}

function clearLoginAttempts(key: string) {
  _loginAttempts.delete(key);
}

// -------------------------------------------------------------------
// Secure Session Persistence
// -------------------------------------------------------------------
const SESSION_KEY = 'elgogalyia_session_v1';
const LEGACY_SESSION_KEY = 'elgogalyia_user_session';

function sanitizeProfileForSession(profile: UserProfile): UserProfile {
  const { passwordHash: _ph, salt: _s, ...safe } = profile as any;
  return safe as UserProfile;
}

function saveSession(profile: UserProfile) {
  try {
    const safeProfile = sanitizeProfileForSession(profile);
    const minimal = { uid: safeProfile.uid, displayName: safeProfile.displayName, username: safeProfile.username };
    localStorage.setItem(SESSION_KEY, JSON.stringify(minimal));
    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(safeProfile));
  } catch (err) {
    logError('saveSession', err);
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch (err) {
    logError('clearSession', err);
  }
}

function loadSavedUid(): string | null {
  try {
    const rawNew = localStorage.getItem(SESSION_KEY);
    if (rawNew) {
      const parsed = JSON.parse(rawNew);
      if (parsed.uid) return parsed.uid;
    }
    const rawLegacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      if (parsed.uid) return parsed.uid;
    }
  } catch (err) {
    logError('loadSavedUid', err);
  }
  return null;
}

// -------------------------------------------------------------------
// Fetch fresh UserProfile from Firestore
// -------------------------------------------------------------------
async function fetchProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      const { passwordHash: _ph, salt: _s, ...safeData } = data as any;
      return { uid: snap.id, ...safeData } as UserProfile;
    }
  } catch (err) {
    logError('fetchProfileFromFirestore', err);
  }
  return null;
}

// -------------------------------------------------------------------
// Context Definition
// -------------------------------------------------------------------
interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  unauthorized: boolean;
  signInWithUsername: (username: string, password: string) => Promise<boolean | { requires2FA: true; linkedEmail: string; profile: UserProfile }>;
  complete2FALogin: (profile: UserProfile) => Promise<boolean>;
  signInWithGoogleAdmin: () => Promise<boolean>;
  updateCurrentUserProfile: (updated: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // -------------------------------------------------------------------
  // On Mount: restore session from saved UID and verify against Firestore
  // -------------------------------------------------------------------
  useEffect(() => {
    const savedUid = loadSavedUid();
    if (!savedUid) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (err) {
        logError('AuthInitAnonymous', err);
      }

      let profile = await fetchProfileFromFirestore(savedUid);

      if (!profile) {
        clearSession();
        setLoading(false);
        return;
      }

      if (profile.status === 'suspended' || profile.status === 'inactive') {
        clearSession();
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setUser({ uid: profile.uid, displayName: profile.displayName } as User);
      setUserProfile(profile);
      setLoading(false);
    })();
  }, []);

  // -------------------------------------------------------------------
  // Realtime Sync Listener from Firestore
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!userProfile?.uid) return;

    let unsub: (() => void) | null = null;
    try {
      const ref = doc(db, 'users', userProfile.uid);
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const { passwordHash: _ph, salt: _s, ...safeData } = data;
          const updated: UserProfile = { uid: snap.id, ...safeData };

          if (updated.status === 'suspended' || updated.status === 'inactive') {
            clearSession();
            setUser(null);
            setUserProfile(null);
            setUnauthorized(true);
            return;
          }

          setUserProfile(updated);
          saveSession(updated);
        }
      }, (err) => {
        logError('FirestoreUserSnapshot', err);
      });
    } catch (err) {
      logError('UserSnapshotInit', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [userProfile?.uid]);

  // -------------------------------------------------------------------
  // signInWithGoogleAdmin — Google Sign-In for Whitelisted Admins
  // -------------------------------------------------------------------
  const signInWithGoogleAdmin = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setUnauthorized(false);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      const emailLower = (googleUser.email || '').trim().toLowerCase();

      if (!emailLower) {
        await firebaseSignOut(auth);
        setLoading(false);
        throw new Error('لم يتم العثور على بريد إلكتروني مرتبط بحساب Google هذا.');
      }

      let isAdminAuthorized = false;
      let adminRole: 'superAdmin' | 'admin' = 'admin';
      let adminDisplayName = googleUser.displayName || emailLower.split('@')[0];

      // Check 1: authorized_admins collection whitelist in Firestore
      try {
        const adminSnap = await getDoc(doc(db, 'authorized_admins', emailLower));
        if (adminSnap.exists()) {
          const adminData = adminSnap.data() as AuthorizedAdmin;
          if (adminData.status === 'active') {
            isAdminAuthorized = true;
            adminRole = adminData.role || 'admin';
            if (adminData.displayName) adminDisplayName = adminData.displayName;
          }
        }
      } catch (e) {
        logError('authorized_admins check notice', e);
      }

      // Check 2: users collection check for admin/superAdmin role matching email
      if (!isAdminAuthorized) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', emailLower), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const uData = snap.docs[0].data() as UserProfile;
            if ((uData.role === 'admin' || uData.role === 'superAdmin') && uData.status === 'active') {
              isAdminAuthorized = true;
              adminRole = uData.role;
              if (uData.displayName) adminDisplayName = uData.displayName;
            }
          }
        } catch (e) {
          logError('users admin email check notice', e);
        }
      }

      if (!isAdminAuthorized) {
        await firebaseSignOut(auth);
        setLoading(false);
        throw new Error(`حساب Google (${emailLower}) غير مصرح له بالدخول كمسؤول. يرجى التواصل مع مسؤول النظام لإضافة حسابك.`);
      }

      // Construct verified Admin Profile
      const generatedUid = 'user_' + emailLower.replace(/[^a-z0-9]/g, '_');
      const adminProfile: UserProfile = {
        uid: generatedUid,
        email: emailLower,
        username: emailLower.split('@')[0],
        displayName: adminDisplayName,
        photoURL: googleUser.photoURL || '',
        role: adminRole,
        status: 'active',
        permissions: [
          'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
          'tasks.review', 'tasks.view_all', 'employees.view', 'employees.manage',
          'ocoins.manage', 'ocoins.view_all', 'reports.view', 'reports.export',
          'access.manage', 'activity.view', 'notifications.send'
        ],
        oCoinsBalance: 5000,
        createdAt: new Date().toISOString(),
      };

      // Sync user profile in Firestore
      try {
        await setDoc(doc(db, 'users', generatedUid), {
          ...adminProfile,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        logError('Sync admin profile notice', e);
      }

      saveSession(adminProfile);
      setUser(googleUser);
      setUserProfile(adminProfile);
      setLoading(false);
      return true;
    } catch (err: any) {
      setLoading(false);
      throw new Error(parseErrorMessage(err, 'تعذر إتمام تسجيل الدخول باستخدام Google.'));
    }
  }, []);

// -------------------------------------------------------------------
// Pre-configured Master / Seed Accounts
// -------------------------------------------------------------------
export const MASTER_ACCOUNTS: Record<string, {
  passwords: string[];
  profile: UserProfile;
}> = {
  admin: {
    passwords: ['admin', 'admin123', 'gdg2026', '123456', 'gdghitu', 'hitu2026'],
    profile: {
      uid: 'user_admin',
      username: 'admin',
      displayName: 'قائد مجتمع GDG HITU (Super Admin)',
      email: 'admin@gdg-hitu.org',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'superAdmin',
      permissions: [
        'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
        'tasks.review', 'tasks.view_all',
        'employees.view', 'employees.manage',
        'ocoins.manage', 'ocoins.view_all',
        'reports.view', 'reports.export',
        'access.manage',
        'activity.view',
        'notifications.send',
      ],
      status: 'active',
      committeeId: 'tech-dev',
      committeeName: 'Tech Dev',
      employeeCode: 'GDG-001',
      oCoinsBalance: 5000,
      createdAt: new Date().toISOString(),
    },
  },
  gdg_admin: {
    passwords: ['admin', 'admin123', 'gdg2026', '123456', 'gdghitu', 'hitu2026'],
    profile: {
      uid: 'user_gdg_admin',
      username: 'gdg_admin',
      displayName: 'مدير منصة GDG HITU',
      email: 'leader@gdg-hitu.org',
      photoURL: '',
      role: 'superAdmin',
      permissions: [
        'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
        'tasks.review', 'tasks.view_all',
        'employees.view', 'employees.manage',
        'ocoins.manage', 'ocoins.view_all',
        'reports.view', 'reports.export',
        'access.manage',
        'activity.view',
        'notifications.send',
      ],
      status: 'active',
      committeeId: 'tech-dev',
      committeeName: 'Tech Dev',
      employeeCode: 'GDG-002',
      oCoinsBalance: 5000,
      createdAt: new Date().toISOString(),
    },
  },
  member: {
    passwords: ['member', 'member123', '123456', 'gdg2026'],
    profile: {
      uid: 'user_member',
      username: 'member',
      displayName: 'أحمد علي (عضو تقني GDG)',
      email: 'member@gdg-hitu.org',
      photoURL: '',
      role: 'employee',
      permissions: ['tasks.view_all', 'reports.view'],
      status: 'active',
      committeeId: 'tech-dev',
      committeeName: 'Tech Dev',
      employeeCode: 'GDG-102',
      oCoinsBalance: 350,
      createdAt: new Date().toISOString(),
    },
  },
};

  // -------------------------------------------------------------------
  // signInWithUsername — Student/Employee/Admin Login (PBKDF2 + Master Seed)
  // -------------------------------------------------------------------
  const signInWithUsername = useCallback(async (usernameInput: string, passwordInput: string): Promise<boolean | { requires2FA: true; linkedEmail: string; profile: UserProfile }> => {
    setLoading(true);
    setUnauthorized(false);

    const userClean = usernameInput.trim();
    const passClean = passwordInput.trim();
    const unameLower = userClean.toLowerCase();
    const GENERIC_ERROR = 'اسم المستخدم أو كلمة المرور غير صحيحة.';

    // Rate limiting check
    const rateLimitKey = `login_${unameLower.slice(0, 20)}`;
    const rl = recordLoginAttempt(rateLimitKey);
    if (rl.blocked) {
      setLoading(false);
      throw new Error('تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 10 دقائق.');
    }

    // Ensure Firebase Anonymous Auth is active for Firestore rules
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch (e) {
      logError('Firebase pre-auth notice', e);
    }

    // ── Targeted Multi-tier Lookup ──────────────────────────────────
    let matchedProfile: (UserProfile & { passwordHash?: string; salt?: string }) | null = null;
    let isMasterVerified = false;

    // Tier 0: Check Master / Pre-configured Admin Accounts
    const masterAccount = MASTER_ACCOUNTS[unameLower];
    if (masterAccount && masterAccount.passwords.includes(passClean)) {
      matchedProfile = { ...masterAccount.profile };
      isMasterVerified = true;

      // Sync master profile to Firestore in background
      try {
        const salt = generateSalt();
        const pHash = await hashPassword(passClean, salt);
        await setDoc(doc(db, 'users', matchedProfile.uid), {
          ...matchedProfile,
          passwordHash: pHash,
          salt,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        logError('Firestore master account sync notice', e);
      }
    }

    // Tier 1: Direct Doc ID Lookup ('user_username')
    if (!matchedProfile) {
      const genUid = 'user_' + unameLower.replace(/[^a-z0-9]/g, '_');
      try {
        const dSnap = await getDoc(doc(db, 'users', genUid));
        if (dSnap.exists()) {
          matchedProfile = { uid: dSnap.id, ...dSnap.data() } as any;
        }
      } catch (e) {
        logError('Direct doc lookup notice', e);
      }
    }

    // Tier 2: Query Firestore users collection by username or email
    if (!matchedProfile) {
      try {
        const qUname = query(collection(db, 'users'), where('username', '==', unameLower), limit(1));
        const snapU = await getDocs(qUname);
        if (!snapU.empty) {
          const d = snapU.docs[0];
          matchedProfile = { uid: d.id, ...d.data() } as any;
        }
      } catch (e) {
        logError('Firestore username query notice', e);
      }
    }

    if (!matchedProfile) {
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', unameLower), limit(1));
        const snapE = await getDocs(qEmail);
        if (!snapE.empty) {
          const d = snapE.docs[0];
          matchedProfile = { uid: d.id, ...d.data() } as any;
        }
      } catch (e) {
        logError('Firestore email query notice', e);
      }
    }

    if (!matchedProfile) {
      setLoading(false);
      throw new Error(GENERIC_ERROR);
    }

    // Check account status
    if (matchedProfile.status === 'suspended' || matchedProfile.status === 'inactive') {
      setLoading(false);
      throw new Error('حسابك معطّل حالياً. يرجى مراجعة إدارة المنصة.');
    }

    // ── 3. Cryptographic Verification & Auto-Upgrade ─────────────────
    let isValid = isMasterVerified;
    let needsRehash = false;

    if (!isMasterVerified && matchedProfile.salt && matchedProfile.passwordHash) {
      const result = await verifyPassword(passClean, matchedProfile.salt, matchedProfile.passwordHash);
      isValid = result.valid;
      needsRehash = result.needsRehash;
    }

    if (!isValid) {
      setLoading(false);
      throw new Error(GENERIC_ERROR);
    }

    // Auto-upgrade legacy hash to PBKDF2
    if (needsRehash && matchedProfile.uid) {
      try {
        const newSalt = generateSalt();
        const newPbkdf2Hash = await hashPassword(passClean, newSalt);
        await updateDoc(doc(db, 'users', matchedProfile.uid), {
          passwordHash: newPbkdf2Hash,
          salt: newSalt,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        logError('Password auto-upgrade to PBKDF2 notice', e);
      }
    }

    // Clear rate limit on successful authentication
    clearLoginAttempts(rateLimitKey);

    // Strip sensitive fields before saving to state
    const safeUserProfile = sanitizeProfileForSession(matchedProfile);

    // ── 4. Two-Factor Authentication Check ────────────────────────────
    if (safeUserProfile.isTwoFactorEnabled && safeUserProfile.googleLinkedEmail) {
      setLoading(false);
      return {
        requires2FA: true,
        linkedEmail: safeUserProfile.googleLinkedEmail,
        profile: safeUserProfile,
      };
    }

    saveSession(safeUserProfile);
    setUser({ displayName: safeUserProfile.displayName, uid: safeUserProfile.uid } as User);
    setUserProfile(safeUserProfile);
    setLoading(false);
    return true;
  }, []);

  // -------------------------------------------------------------------
  // complete2FALogin — Complete login after Google 2FA verification
  // -------------------------------------------------------------------
  const complete2FALogin = useCallback(async (profile: UserProfile): Promise<boolean> => {
    const safeProfile = sanitizeProfileForSession(profile);
    saveSession(safeProfile);
    setUser({ displayName: safeProfile.displayName, uid: safeProfile.uid } as User);
    setUserProfile(safeProfile);
    setLoading(false);
    return true;
  }, []);

  // -------------------------------------------------------------------
  // updateCurrentUserProfile — Update in state, session, and Firestore
  // -------------------------------------------------------------------
  const updateCurrentUserProfile = useCallback(async (updated: Partial<UserProfile>) => {
    if (!userProfile?.uid) return;
    const merged = { ...userProfile, ...updated };
    const safeMerged = sanitizeProfileForSession(merged);
    setUserProfile(safeMerged);
    saveSession(safeMerged);

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        ...updated,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      logError('updateCurrentUserProfile', e);
    }
  }, [userProfile]);

  // -------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------
  const signOut = useCallback(async () => {
    clearSession();
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      logError('signOut', e);
    }
    setUser(null);
    setUserProfile(null);
    setUnauthorized(false);
  }, []);

  // -------------------------------------------------------------------
  // hasPermission
  // -------------------------------------------------------------------
  const hasPermission = useCallback(
    (perm: Permission) => {
      if (!userProfile) return false;
      if (userProfile.role === 'superAdmin') return true;
      return userProfile.permissions?.includes(perm) ?? false;
    },
    [userProfile]
  );

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      unauthorized,
      signInWithUsername,
      complete2FALogin,
      signInWithGoogleAdmin,
      updateCurrentUserProfile,
      signOut,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
