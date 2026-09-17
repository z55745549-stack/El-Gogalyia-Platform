import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'lead' | 'co_lead' | 'head' | 'vice_head' | 'member';
type SupabaseAnyClient = any;

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

const AUTH_USER_COLUMNS = `${SAFE_USER_COLUMNS},password_hash,salt`;

export const ADMIN_PERMISSIONS = [
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'tasks.assign',
  'tasks.review',
  'tasks.view_all',
  'employees.view',
  'employees.manage',
  'ocoins.manage',
  'ocoins.view_all',
  'reports.view',
  'reports.export',
  'access.manage',
  'activity.view',
  'notifications.send',
];

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === 'lead' || role === 'co_lead' || role === 'head' || role === 'vice_head' || role === 'member') {
    return role;
  }
  if (role === 'admin' || role === 'superAdmin') return 'lead';
  if (role === 'employee') return 'member';
  return 'member';
}

export function isUnlimitedRole(role: string | null | undefined) {
  return role === 'lead' || role === 'co_lead' || role === 'head' || role === 'admin' || role === 'superAdmin';
}

export function mapUserRowToProfile(row: any) {
  const role = normalizeRole(row.role);
  return {
    uid: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? '',
    photoURL: row.photo_url ?? '',
    role,
    status: row.status,
    committeeId: row.committee_id ?? undefined,
    committeeName: row.committee_name || (role === 'lead' || role === 'co_lead' ? 'بدون لجنة' : undefined),
    specialtyTag: row.specialty_tag ?? undefined,
    employeeCode: row.employee_code ?? undefined,
    oCoinsBalance: isUnlimitedRole(role) ? (row.ocoins_balance ?? null) : (row.ocoins_balance ?? 0),
    permissions: row.permissions ?? [],
    isTwoFactorEnabled: row.is_two_factor_enabled ?? false,
    googleLinkedEmail: row.google_linked_email ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserForLogin(supabase: SupabaseAnyClient, login: string): Promise<any | null> {
  const clean = login.trim();
  const lower = clean.toLowerCase();
  const cleanId = lower.replace(/[^a-z0-9_-]/g, '_');
  const genUid = `user_${cleanId}`;

  const direct = await supabase.from('users').select(AUTH_USER_COLUMNS).eq('id', genUid).maybeSingle();
  if (direct.data) return direct.data;

  const variants = [
    lower,
    lower.replace(/\s+/g, '-'),
    lower.replace(/\s+/g, '_'),
    lower.replace(/-/g, '_'),
    lower.replace(/_/g, '-'),
    lower.replace(/[^a-z0-9]/g, ''),
  ];

  const byUsername = await supabase
    .from('users')
    .select(AUTH_USER_COLUMNS)
    .in('username', variants)
    .limit(1)
    .maybeSingle();
  if (byUsername.data) return byUsername.data;

  const byDisplayName = await supabase
    .from('users')
    .select(AUTH_USER_COLUMNS)
    .ilike('display_name', lower)
    .limit(1)
    .maybeSingle();
  if (byDisplayName.data) return byDisplayName.data;

  const byEmail = await supabase
    .from('users')
    .select(AUTH_USER_COLUMNS)
    .eq('email', lower)
    .limit(1)
    .maybeSingle();
  return byEmail.data ?? null;
}

function constantTimeHexEqual(left: string, right: string) {
  try {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function pbkdf2Hash(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

function legacySha256(password: string, salt: string, separator: ':' | '') {
  return createHash('sha256').update(`${password}${separator}${salt}`).digest('hex');
}

export function generateSalt() {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string) {
  return `pbkdf2$${pbkdf2Hash(password, salt)}`;
}

export function verifyStoredPassword(password: string, salt: string, storedHash: string) {
  if (!password || !salt || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('pbkdf2$')) {
    return {
      valid: constantTimeHexEqual(pbkdf2Hash(password, salt), storedHash.slice('pbkdf2$'.length)),
      needsRehash: false,
    };
  }

  const legacyWithColon = legacySha256(password, salt, ':');
  const legacyWithoutColon = legacySha256(password, salt, '');
  const valid =
    constantTimeHexEqual(legacyWithColon, storedHash) ||
    constantTimeHexEqual(legacyWithoutColon, storedHash);

  return { valid, needsRehash: valid };
}

export async function fetchSafeProfile(supabase: SupabaseAnyClient, uid: string) {
  const { data, error } = await supabase
    .from('users')
    .select(SAFE_USER_COLUMNS)
    .eq('id', uid)
    .maybeSingle();

  if (error || !data) return null;
  return mapUserRowToProfile(data);
}
