import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  fetchSafeProfile,
  findUserForLogin,
  generateSalt,
  getSupabaseAdminClient,
  hashPassword,
  mapUserRowToProfile,
  normalizeRole,
  verifyStoredPassword,
} from './_auth-utils.js';

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= LOGIN_MAX_ATTEMPTS;
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function trySupabaseAuthLogin(login: string, password: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !login.includes('@')) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email: login.toLowerCase(),
    password,
  });
  if (error || !data.user) return null;
  return data.user.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed.' });
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return sendJson(res, 400, { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
  }

  const rateLimitKey = username.toLowerCase().slice(0, 80);
  if (!checkRateLimit(rateLimitKey)) {
    return sendJson(res, 429, {
      success: false,
      error: 'تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 10 دقائق.',
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    let row = await findUserForLogin(supabase, username);
    let authenticatedBySupabaseAuth = false;

    if (!row || !row.password_hash || !row.salt) {
      const authUserId = await trySupabaseAuthLogin(row?.email || username, password);
      if (authUserId) {
        const { data } = await supabase.from('users').select('*').eq('id', authUserId).maybeSingle();
        if (data) {
          row = data;
          authenticatedBySupabaseAuth = true;
        }
      }
    }

    if (!row) {
      return sendJson(res, 401, { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }

    if (row.status === 'pending') {
      return sendJson(res, 403, {
        success: false,
        error: 'حسابك قيد المراجعة والاعتماد من قِبل قيادة الجوجالية. ستتمكن من تسجيل الدخول فور الموافقة وتفعيل الحساب.',
      });
    }
    if (row.status === 'suspended' || row.status === 'inactive') {
      return sendJson(res, 403, { success: false, error: 'حسابك معطّل حالياً. يرجى مراجعة إدارة المنصة.' });
    }

    if (!authenticatedBySupabaseAuth) {
      const result = verifyStoredPassword(password, row.salt, row.password_hash);
      if (!result.valid) {
        return sendJson(res, 401, { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
      }

      if (result.needsRehash) {
        const salt = generateSalt();
        await supabase
          .from('users')
          .update({
            password_hash: hashPassword(password, salt),
            salt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    }

    const normalizedRole = normalizeRole(row.role);
    if (normalizedRole !== row.role) {
      await supabase
        .from('users')
        .update({ role: normalizedRole, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      row.role = normalizedRole;
    }

    clearRateLimit(rateLimitKey);
    const profile = (await fetchSafeProfile(supabase, row.id)) || mapUserRowToProfile(row);
    return sendJson(res, 200, { success: true, profile });
  } catch (err) {
    console.error('[auth-login] error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'خطأ في إعداد تسجيل الدخول على الخادم. يرجى ضبط SUPABASE_SERVICE_ROLE_KEY في متغيرات البيئة.',
    });
  }
}
