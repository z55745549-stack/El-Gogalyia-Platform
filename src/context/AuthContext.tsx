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
import { generateSalt, hashPassword } from '@/lib/auth-security';
import { parseErrorMessage, logError } from '@/lib/errors';
import type { UserProfile, Permission } from '@/types';
import { isAdminRole } from '@/utils/permissions';
import { authenticateWithDevice } from '@/lib/webauthn';
import { formatFullName, hasUnlimitedCoins } from '@/utils';
import { logActivity } from '@/lib/database-service';

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
const SAFE_USER_COLUMNS = [
  'id',
  'username',
  'display_name',
  'email',
  'photo_url',
  'role',
  'permissions',
  'status',
  'committee_id',
  'committee_name',
  'specialty_tag',
  'employee_code',
  'ocoins_balance',
  'google_linked_email',
  'is_two_factor_enabled',
  'created_at',
  'updated_at',
].join(',');

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
      .select(SAFE_USER_COLUMNS)
      .eq('id', uid)
      .maybeSingle();

    if (error || !data) {
      clearSession();
      return null;
    }

    return mapRowToProfile(data);
  } catch (err) {
    logError('fetchProfileFromSupabase', err);
    clearSession();
    return null;
  }
}

// -------------------------------------------------------------------
// Map a Supabase users row → UserProfile shape
// -------------------------------------------------------------------
function mapRowToProfile(row: any): UserProfile {
  const role = row.role;
  // FIX #3: Unlimited-coin roles (head, lead, co_lead) must preserve null balance — never default to 0
  const oCoinsBalance = hasUnlimitedCoins(role)
    ? (row.ocoins_balance ?? null)
    : (row.ocoins_balance ?? 0);
  return {
    uid: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? '',
    photoURL: row.photo_url ?? '',
    role,
    status: row.status,
    committeeId: row.committee_id ?? undefined,
    committeeName: row.committee_name || (row.role === 'lead' || row.role === 'co_lead' ? 'بدون لجنة' : undefined),
    specialtyTag: row.specialty_tag || row.specialtyTag || undefined,
    employeeCode: row.employee_code ?? undefined,
    oCoinsBalance,
    permissions: row.permissions ?? [],
    isTwoFactorEnabled: row.is_two_factor_enabled ?? false,
    googleLinkedEmail: row.google_linked_email ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -------------------------------------------------------------------
// Context Definition
// -------------------------------------------------------------------
// -------------------------------------------------------------------
interface AuthContextValue {
  user: { uid: string; displayName: string | null } | null;
  userProfile: UserProfile | null;
  loading: boolean;
  unauthorized: boolean;
  signInWithUsername: (username: string, password: string) => Promise<boolean | { requires2FA: true; linkedEmail: string; profile: UserProfile }>;
  signInWithDevice: (username?: string) => Promise<{ success: boolean; error?: string }>;
  complete2FALogin: (profile: UserProfile) => Promise<boolean>;
  signInWithGoogleAdmin: () => Promise<boolean>;
  registerMember: (data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    committeeId: string;
    committeeName: string;
    specialtyTag?: string;
  }) => Promise<void>;
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
  // Realtime profile sync: refresh balance & profile when Supabase or
  // localStorage signals a data change (e.g. admin adds OCoins)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!user?.uid) return;

    const refreshProfile = async () => {
      try {
        const fresh = await fetchProfileFromSupabase(user.uid);
        if (fresh && fresh.status !== 'suspended' && fresh.status !== 'inactive') {
          setUserProfile((prev) => {
            // Only update if something changed (avoid unnecessary re-renders)
            if (!prev) return fresh;
            if (
              prev.oCoinsBalance !== fresh.oCoinsBalance ||
              prev.role !== fresh.role ||
              prev.status !== fresh.status ||
              prev.displayName !== fresh.displayName ||
              prev.committeeName !== fresh.committeeName
            ) {
              return fresh;
            }
            return prev;
          });
        }
      } catch { /* silent */ }
    };

    // Listen for any platform-wide data change events
    const handleDataChange = () => { refreshProfile(); };
    window.addEventListener('elgogalyia_data_change', handleDataChange);

    // Also subscribe to Supabase Realtime for the users table
    const channel = supabase
      .channel(`user_profile_${user.uid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, () => {
        refreshProfile();
      })
      .subscribe();

    return () => {
      window.removeEventListener('elgogalyia_data_change', handleDataChange);
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);


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
    // Note: Do not call setLoading(true) here. LoginPage maintains its own button loading state
    // preventing any jarring full-screen loading flash during authentication.
    setUnauthorized(false);

    const userClean = usernameInput.trim();
    const passClean = passwordInput.trim();
    const unameLower = userClean.toLowerCase();
    const GENERIC_ERROR = 'اسم المستخدم أو كلمة المرور غير صحيحة.';

    // Rate limiting check
    const rateLimitKey = `login_${unameLower.slice(0, 20)}`;
    const rl = recordLoginAttempt(rateLimitKey);
    if (rl.blocked) {
      throw new Error('تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 10 دقائق.');
    }

    let safeUserProfile: UserProfile;
    try {
      const response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userClean, password: passClean }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !payload?.profile) {
        throw new Error(payload?.error || GENERIC_ERROR);
      }
      safeUserProfile = sanitizeProfileForSession(payload.profile as UserProfile);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(GENERIC_ERROR);
    }

    // Clear rate limit on success
    clearLoginAttempts(rateLimitKey);

    // ── 2FA Check ────────────────────────────────────────────────────
    if (safeUserProfile.isTwoFactorEnabled && safeUserProfile.googleLinkedEmail) {
      return {
        requires2FA: true,
        linkedEmail: safeUserProfile.googleLinkedEmail,
        profile: safeUserProfile,
      };
    }

    saveSession(safeUserProfile);
    setUser({ uid: safeUserProfile.uid, displayName: safeUserProfile.displayName });
    setUserProfile(safeUserProfile);

    void logActivity({
      actor: {
        id: safeUserProfile.uid,
        name: safeUserProfile.displayName || safeUserProfile.username,
        role: safeUserProfile.role,
      },
      action: 'auth.login',
      targetType: 'auth',
      targetId: safeUserProfile.uid,
      targetName: safeUserProfile.displayName || safeUserProfile.username,
      details: `قام المستخدم ${safeUserProfile.displayName || safeUserProfile.username} بتسجيل الدخول إلى المنصة.`,
    });

    return true;
  }, []);

  // -------------------------------------------------------------------
  // signInWithDevice — WebAuthn / Passkey login
  // -------------------------------------------------------------------
  const signInWithDevice = useCallback(async (username?: string): Promise<{ success: boolean; error?: string }> => {
    const result = await authenticateWithDevice(username);
    if (!result.userId) {
      return { success: false, error: result.error };
    }

    const profile = await fetchProfileFromSupabase(result.userId);
    if (!profile) {
      return { success: false, error: 'لم يُعثر على الحساب المرتبط بهذا الجهاز.' };
    }
    if (profile.status === 'pending') {
      return { success: false, error: 'حسابك قيد المراجعة ولا يمكن الدخول بعد.' };
    }
    if (profile.status === 'suspended' || profile.status === 'inactive') {
      return { success: false, error: 'حسابك معطّل. يرجى مراجعة إدارة المنصة.' };
    }

    const safeProfile = sanitizeProfileForSession(profile);
    saveSession(safeProfile);
    setUser({ uid: safeProfile.uid, displayName: safeProfile.displayName });
    setUserProfile(safeProfile);

    void logActivity({
      actor: {
        id: safeProfile.uid,
        name: safeProfile.displayName || safeProfile.username,
        role: safeProfile.role,
      },
      action: 'auth.login',
      targetType: 'auth',
      targetId: safeProfile.uid,
      targetName: safeProfile.displayName || safeProfile.username,
      details: `تسجيل دخول بيومتري / مفتاح أمان للمستخدم ${safeProfile.displayName || safeProfile.username}.`,
    });

    return { success: true };
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

    void logActivity({
      actor: {
        id: safeProfile.uid,
        name: safeProfile.displayName || safeProfile.username,
        role: safeProfile.role,
      },
      action: 'auth.login',
      targetType: 'auth',
      targetId: safeProfile.uid,
      targetName: safeProfile.displayName || safeProfile.username,
      details: `إتمام التحقق بخطوتين (2FA) وتسجيل الدخول للمستخدم ${safeProfile.displayName || safeProfile.username}.`,
    });

    return true;
  }, []);

  // -------------------------------------------------------------------
  // updateCurrentUserProfile
  // -------------------------------------------------------------------
  const updateCurrentUserProfile = useCallback(async (updated: Partial<UserProfile>) => {
    if (!userProfile?.uid) return;
    // Security: explicitly drop role to prevent privilege escalation from client-side calls
    const { role: _droppedRole, ...safeUpdated } = updated;
    const merged = { ...userProfile, ...safeUpdated };
    const safeMerged = sanitizeProfileForSession(merged);
    setUserProfile(safeMerged);
    saveSession(safeMerged);

    try {
      // Build Supabase column map from UserProfile fields
      const dbUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (safeUpdated.displayName !== undefined) dbUpdate.display_name = safeUpdated.displayName;
      if (safeUpdated.email !== undefined) dbUpdate.email = safeUpdated.email;
      if (safeUpdated.photoURL !== undefined) dbUpdate.photo_url = safeUpdated.photoURL;
      // NOTE: role changes are NOT allowed from the client via this function.
      // Role must be changed only by admins through EmployeesPage (dedicated admin flow).
      if (safeUpdated.status !== undefined) dbUpdate.status = safeUpdated.status;
      if (safeUpdated.committeeId !== undefined) dbUpdate.committee_id = safeUpdated.committeeId;
      if (safeUpdated.committeeName !== undefined) dbUpdate.committee_name = safeUpdated.committeeName;
      if (safeUpdated.specialtyTag !== undefined) dbUpdate.specialty_tag = safeUpdated.specialtyTag;
      if (safeUpdated.employeeCode !== undefined) dbUpdate.employee_code = safeUpdated.employeeCode;
      // FIX: Never update ocoins_balance to a number for unlimited-coin roles
      if (safeUpdated.oCoinsBalance !== undefined) {
        dbUpdate.ocoins_balance = hasUnlimitedCoins(merged.role) ? null : safeUpdated.oCoinsBalance;
      }
      if (safeUpdated.permissions !== undefined) dbUpdate.permissions = safeUpdated.permissions;
      if (safeUpdated.isTwoFactorEnabled !== undefined) dbUpdate.is_two_factor_enabled = safeUpdated.isTwoFactorEnabled;
      if (safeUpdated.googleLinkedEmail !== undefined) dbUpdate.google_linked_email = safeUpdated.googleLinkedEmail;

      await supabase.from('users').update(dbUpdate).eq('id', userProfile.uid);
    } catch (e) {
      logError('updateCurrentUserProfile', e);
    }
  }, [userProfile]);

  // -------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------
  const signOut = useCallback(async () => {
    if (userProfile) {
      void logActivity({
        actor: {
          id: userProfile.uid,
          name: userProfile.displayName || userProfile.username,
          role: userProfile.role,
        },
        action: 'auth.logout',
        targetType: 'auth',
        targetId: userProfile.uid,
        targetName: userProfile.displayName || userProfile.username,
        details: `قام المستخدم ${userProfile.displayName || userProfile.username} بتسجيل الخروج من المنصة.`,
      });
    }
    clearSession();
    setUser(null);
    setUserProfile(null);
    setUnauthorized(false);
  }, [userProfile]);

  // -------------------------------------------------------------------
  // hasPermission
  // -------------------------------------------------------------------
  const hasPermission = useCallback(
    (perm: Permission) => {
      if (!userProfile) return false;
      if (isAdminRole(userProfile.role)) return true;
      return userProfile.permissions?.includes(perm) ?? false;
    },
    [userProfile]
  );

  // -------------------------------------------------------------------
  // registerMember — Self Registration for Members (Status: Pending)
  // -------------------------------------------------------------------
  const registerMember = useCallback(async (data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    committeeId: string;
    committeeName: string;
    specialtyTag?: string;
  }): Promise<void> => {
    const unameClean = data.username.trim().toLowerCase();
    const emailClean = data.email.trim().toLowerCase();
    const nameClean = formatFullName(data.fullName.trim());
    const passClean = data.password.trim();

    if (!unameClean || !emailClean || !nameClean || !passClean) {
      throw new Error('يرجى ملء جميع الحقول المطلوبة.');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      throw new Error('صيغة البريد الإلكتروني غير صحيحة، يرجى التحقق منه.');
    }

    // Password strength: minimum 8 characters with letters and numbers
    if (passClean.length < 8) {
      throw new Error('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
    }
    if (!/[A-Za-z]/.test(passClean) || !/[0-9]/.test(passClean)) {
      throw new Error('كلمة المرور يجب أن تحتوي على أحرف إنجليزية وأرقام لضمان أمان الحساب.');
    }

    // Check if username or email is already taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${unameClean},email.eq.${emailClean}`)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username?.toLowerCase() === unameClean) {
        throw new Error('اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر.');
      }
      throw new Error('البريد الإلكتروني مسجل بالفعل في منصة الجوجالية.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(passClean, salt);
    const genId = 'user_reg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

    // Generate unique employeeCode with collision check
    let employeeCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const codeNum = Math.floor(33000 + Math.random() * 6999);
      const candidateCode = `GOGA-${codeNum}`;
      const { data: codeSnap } = await supabase
        .from('users')
        .select('id')
        .eq('employee_code', candidateCode)
        .limit(1)
        .maybeSingle();
      if (!codeSnap) {
        employeeCode = candidateCode;
        break;
      }
    }
    if (!employeeCode) {
      employeeCode = `GOGA-${Date.now().toString().slice(-5)}`;
    }

    const newProfile = {
      id: genId,
      username: unameClean,
      display_name: nameClean,
      email: emailClean,
      role: 'member',
      status: 'pending',
      committee_id: data.committeeId === 'none' ? null : (data.committeeId || null),
      committee_name: data.committeeId === 'none' ? 'بدون لجنة' : (data.committeeName || 'Tech Dev'),
      specialty_tag: data.specialtyTag?.trim() || null,
      employee_code: employeeCode,
      ocoins_balance: 0,
      permissions: [],
      password_hash: passwordHash,
      salt: salt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error: insErr } = await supabase.from('users').insert(newProfile);
    if (insErr && (insErr.message?.includes('specialty_tag') || insErr.message?.includes('schema cache'))) {
      const fallbackProfile: any = { ...newProfile };
      delete fallbackProfile.specialty_tag;
      fallbackProfile.raw_data = { ...(fallbackProfile.raw_data || {}), specialty_tag: data.specialtyTag?.trim() || null };
      const retry = await supabase.from('users').insert(fallbackProfile);
      insErr = retry.error;
    }
    if (insErr) {
      logError('registerMember insert', insErr);
      throw new Error(insErr.message || 'حدث خطأ أثناء إرسال طلب الانضمام.');
    }

    void logActivity({
      actor: {
        id: genId,
        name: nameClean,
        role: 'member',
      },
      action: 'auth.join_request',
      targetType: 'user',
      targetId: genId,
      targetName: nameClean,
      details: `طلب انضمام جديد للجنة "${newProfile.committee_name}" من ${nameClean} (${emailClean}).`,
      metadata: {
        committeeId: newProfile.committee_id,
        committeeName: newProfile.committee_name,
        email: emailClean,
        employeeCode,
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      unauthorized,
      signInWithUsername,
      signInWithDevice,
      complete2FALogin,
      signInWithGoogleAdmin,
      registerMember,
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
