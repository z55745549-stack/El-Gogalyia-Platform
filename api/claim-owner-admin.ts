import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ADMIN_PERMISSIONS, fetchSafeProfile, getSupabaseAdminClient } from './_auth-utils.js';

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function envCredentials() {
  return {
    username: process.env.OWNER_CLAIM_USERNAME || process.env.ADD_ADMIN_CONFIRM_USERNAME,
    password: process.env.OWNER_CLAIM_PASSWORD || process.env.ADD_ADMIN_CONFIRM_PASSWORD,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed.' });
  }

  const ownerUsername = String(req.body?.ownerUsername || '').trim();
  const ownerPassword = String(req.body?.ownerPassword || '').trim();
  const profile = req.body?.profile || {};
  const credentials = envCredentials();

  if (!credentials.username || !credentials.password) {
    return sendJson(res, 500, {
      success: false,
      error: 'خطأ في إعداد تفويض مالك المنصة. يرجى ضبط OWNER_CLAIM_USERNAME و OWNER_CLAIM_PASSWORD على الخادم.',
    });
  }

  if (ownerUsername !== credentials.username.trim() || ownerPassword !== credentials.password.trim()) {
    return sendJson(res, 401, {
      success: false,
      error: 'بيانات تفويض مالك المنصة غير صحيحة.',
    });
  }

  const uid = String(profile.uid || '').trim();
  const email = String(profile.email || '').trim().toLowerCase();
  const username = String(profile.username || email.split('@')[0] || '').trim().toLowerCase();
  const displayName = String(profile.displayName || username || 'System Admin').trim();

  if (!uid || !email || !username) {
    return sendJson(res, 400, {
      success: false,
      error: 'لا يمكن تفعيل الصلاحية لهذا الحساب لأن بيانات الحساب الحالية غير مكتملة.',
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('users').upsert(
      {
        id: uid,
        username,
        display_name: displayName,
        email,
        photo_url: profile.photoURL || null,
        role: 'lead',
        status: 'active',
        permissions: ADMIN_PERMISSIONS,
        ocoins_balance: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    const safeProfile = await fetchSafeProfile(supabase, uid);
    return sendJson(res, 200, { success: true, profile: safeProfile });
  } catch (err) {
    console.error('[claim-owner-admin] error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'تعذر تفعيل صلاحية المالك. يرجى التأكد من ضبط SUPABASE_SERVICE_ROLE_KEY.',
    });
  }
}
