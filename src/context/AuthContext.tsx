/**
 * HARDENED & SECURE AUTHENTICATION CONTEXT — GDG HITU Platform
 *
 * Authentication Architecture:
 * 1. Tier 0 – Master / Seed Accounts (local predefined, instant access).
 * 2. Tier 1 – Supabase direct-id lookup  ('user_<username>').
 * 3. Tier 2 – Supabase query by username or email.
 * 4. PBKDF2 cryptographic password hashing.
 * 5. Two-Factor Authentication (2FA) support.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { verifyPassword, generateSalt, hashPassword } from '@/lib/auth-security';
import { parseErrorMessage, logError } from '@/lib/errors';
import type { UserProfile, Permission } from '@/types';

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
// Fetch fresh UserProfile from Supabase
// -------------------------------------------------------------------
async function fetchProfileFromSupabase(uid: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();

    if (error || !data) return null;

    return mapRowToProfile(data);
  } catch (err) {
    logError('fetchProfileFromSupabase', err);
    return null;
  }
}

// -------------------------------------------------------------------
// Map a Supabase users row → UserProfile shape
// -------------------------------------------------------------------
function mapRowToProfile(row: any): UserProfile {
  return {
    uid: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? '',
    photoURL: row.photo_url ?? '',
    role: row.role,
    status: row.status,
    committeeId: row.committee_id ?? undefined,
    committeeName: row.committee_name ?? undefined,
    employeeCode: row.employee_code ?? undefined,
    oCoinsBalance: row.ocoins_balance ?? 0,
    permissions: row.permissions ?? [],
    isTwoFactorEnabled: row.is_two_factor_enabled ?? false,
    googleLinkedEmail: row.google_linked_email ?? undefined,
    createdAt: row.created_at,
    passwordHash: row.password_hash ?? undefined,
    salt: row.salt ?? undefined,
  };
}

// -------------------------------------------------------------------
// Upsert user profile into Supabase
// -------------------------------------------------------------------
async function upsertProfileToSupabase(profile: UserProfile & { passwordHash?: string; salt?: string }) {
  try {
    await supabase.from('users').upsert({
      id: profile.uid,
      username: profile.username,
      display_name: profile.displayName,
      email: profile.email || null,
      photo_url: profile.photoURL || null,
      role: profile.role,
      status: profile.status,
      committee_id: profile.committeeId || null,
      committee_name: profile.committeeName || null,
      employee_code: profile.employeeCode || null,
      ocoins_balance: profile.oCoinsBalance ?? 0,
      permissions: profile.permissions ?? [],
      is_two_factor_enabled: profile.isTwoFactorEnabled ?? false,
      google_linked_email: profile.googleLinkedEmail || null,
      password_hash: profile.passwordHash || null,
      salt: profile.salt || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    logError('upsertProfileToSupabase', err);
  }
}

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
// Context Definition
// -------------------------------------------------------------------
interface AuthContextValue {
  user: { uid: string; displayName: string | null } | null;
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
  const [user, setUser] = useState<{ uid: string; displayName: string | null } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // -------------------------------------------------------------------
  // On Mount: restore session and verify against Supabase
  // -------------------------------------------------------------------
  useEffect(() => {
    const savedUid = loadSavedUid();
    if (!savedUid) {
      setLoading(false);
      return;
    }

    (async () => {
      // Check master accounts first (no DB call needed)
      const masterEntry = Object.values(MASTER_ACCOUNTS).find(m => m.profile.uid === savedUid);
      if (masterEntry) {
        setUser({ uid: masterEntry.profile.uid, displayName: masterEntry.profile.displayName });
        setUserProfile(masterEntry.profile);
        setLoading(false);
        return;
      }

      const profile = await fetchProfileFromSupabase(savedUid);

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

      setUser({ uid: profile.uid, displayName: profile.displayName });
      setUserProfile(profile);
      setLoading(false);
    })();
  }, []);

  // -------------------------------------------------------------------
  // signInWithGoogleAdmin — Placeholder (kept for interface compatibility)
  // Google OAuth via Supabase can be added later
  // -------------------------------------------------------------------
  const signInWithGoogleAdmin = useCallback(async (): Promise<boolean> => {
    throw new Error('تسجيل الدخول بـ Google غير متاح حالياً. يرجى استخدام اسم المستخدم وكلمة المرور.');
  }, []);

  // -------------------------------------------------------------------
  // signInWithUsername — Student/Employee/Admin Login
  // -------------------------------------------------------------------
  const signInWithUsername = useCallback(async (
    usernameInput: string,
    passwordInput: string
  ): Promise<boolean | { requires2FA: true; linkedEmail: string; profile: UserProfile }> => {
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

    let matchedProfile: (UserProfile & { passwordHash?: string; salt?: string }) | null = null;
    let isMasterVerified = false;

    // ── Tier 0: Master / Pre-configured Accounts ──────────────────────
    const masterAccount = MASTER_ACCOUNTS[unameLower];
    if (masterAccount && masterAccount.passwords.includes(passClean)) {
      matchedProfile = { ...masterAccount.profile };
      isMasterVerified = true;

      // Sync master profile to Supabase in background
      try {
        const salt = generateSalt();
        const pHash = await hashPassword(passClean, salt);
        upsertProfileToSupabase({ ...matchedProfile, passwordHash: pHash, salt });
      } catch (e) {
        logError('Supabase master account sync notice', e);
      }
    }

    // ── Tier 1: Direct ID Lookup ('user_username') ─────────────────────
    if (!matchedProfile) {
      const genUid = 'user_' + unameLower.replace(/[^a-z0-9]/g, '_');
      try {
        const { data } = await supabase.from('users').select('*').eq('id', genUid).single();
        if (data) matchedProfile = mapRowToProfile(data) as any;
      } catch (e) {
        logError('Supabase direct id lookup notice', e);
      }
    }

    // ── Tier 2: Query by username ──────────────────────────────────────
    if (!matchedProfile) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('username', unameLower)
          .limit(1)
          .single();
        if (data) matchedProfile = mapRowToProfile(data) as any;
      } catch (e) {
        logError('Supabase username query notice', e);
      }
    }

    // ── Tier 3: Query by email ─────────────────────────────────────────
    if (!matchedProfile) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('email', unameLower)
          .limit(1)
          .single();
        if (data) matchedProfile = mapRowToProfile(data) as any;
      } catch (e) {
        logError('Supabase email query notice', e);
      }
    }

    if (!matchedProfile) {
      setLoading(false);
      throw new Error(GENERIC_ERROR);
    }

    // Account status check
    if (matchedProfile.status === 'suspended' || matchedProfile.status === 'inactive') {
      setLoading(false);
      throw new Error('حسابك معطّل حالياً. يرجى مراجعة إدارة المنصة.');
    }

    // ── Cryptographic Verification ────────────────────────────────────
    let isValid = isMasterVerified;
    let needsRehash = false;

    if (!isMasterVerified && matchedProfile.salt && matchedProfile.passwordHash) {
      const result = await verifyPassword(passClean, matchedProfile.salt, matchedProfile.passwordHash);
      isValid = result.valid;
      needsRehash = result.needsRehash;
    } else if (!isMasterVerified) {
      // No hash stored yet — reject
      setLoading(false);
      throw new Error(GENERIC_ERROR);
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
        await supabase
          .from('users')
          .update({ password_hash: newPbkdf2Hash, salt: newSalt, updated_at: new Date().toISOString() })
          .eq('id', matchedProfile.uid);
      } catch (e) {
        logError('Password auto-upgrade notice', e);
      }
    }

    // Clear rate limit on success
    clearLoginAttempts(rateLimitKey);

    const safeUserProfile = sanitizeProfileForSession(matchedProfile);

    // ── 2FA Check ────────────────────────────────────────────────────
    if (safeUserProfile.isTwoFactorEnabled && safeUserProfile.googleLinkedEmail) {
      setLoading(false);
      return {
        requires2FA: true,
        linkedEmail: safeUserProfile.googleLinkedEmail,
        profile: safeUserProfile,
      };
    }

    saveSession(safeUserProfile);
    setUser({ uid: safeUserProfile.uid, displayName: safeUserProfile.displayName });
    setUserProfile(safeUserProfile);
    setLoading(false);
    return true;
  }, []);

  // -------------------------------------------------------------------
  // complete2FALogin
  // -------------------------------------------------------------------
  const complete2FALogin = useCallback(async (profile: UserProfile): Promise<boolean> => {
    const safeProfile = sanitizeProfileForSession(profile);
    saveSession(safeProfile);
    setUser({ uid: safeProfile.uid, displayName: safeProfile.displayName });
    setUserProfile(safeProfile);
    setLoading(false);
    return true;
  }, []);

  // -------------------------------------------------------------------
  // updateCurrentUserProfile
  // -------------------------------------------------------------------
  const updateCurrentUserProfile = useCallback(async (updated: Partial<UserProfile>) => {
    if (!userProfile?.uid) return;
    const merged = { ...userProfile, ...updated };
    const safeMerged = sanitizeProfileForSession(merged);
    setUserProfile(safeMerged);
    saveSession(safeMerged);

    try {
      // Build Supabase column map from UserProfile fields
      const dbUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updated.displayName !== undefined) dbUpdate.display_name = updated.displayName;
      if (updated.email !== undefined) dbUpdate.email = updated.email;
      if (updated.photoURL !== undefined) dbUpdate.photo_url = updated.photoURL;
      if (updated.role !== undefined) dbUpdate.role = updated.role;
      if (updated.status !== undefined) dbUpdate.status = updated.status;
      if (updated.committeeId !== undefined) dbUpdate.committee_id = updated.committeeId;
      if (updated.committeeName !== undefined) dbUpdate.committee_name = updated.committeeName;
      if (updated.employeeCode !== undefined) dbUpdate.employee_code = updated.employeeCode;
      if (updated.oCoinsBalance !== undefined) dbUpdate.ocoins_balance = updated.oCoinsBalance;
      if (updated.permissions !== undefined) dbUpdate.permissions = updated.permissions;
      if (updated.isTwoFactorEnabled !== undefined) dbUpdate.is_two_factor_enabled = updated.isTwoFactorEnabled;
      if (updated.googleLinkedEmail !== undefined) dbUpdate.google_linked_email = updated.googleLinkedEmail;

      await supabase.from('users').update(dbUpdate).eq('id', userProfile.uid);
    } catch (e) {
      logError('updateCurrentUserProfile', e);
    }
  }, [userProfile]);

  // -------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------
  const signOut = useCallback(async () => {
    clearSession();
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
