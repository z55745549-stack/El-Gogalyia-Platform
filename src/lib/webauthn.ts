/**
 * webauthn.ts — منصة الجوجالية
 * WebAuthn / Passkey utilities: register, authenticate, and manage device credentials.
 * Uses discoverable credentials (Passkeys) so the user is identified from the device itself.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCredential {
  id: string;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Support Check ────────────────────────────────────────────────────────────

export async function isWebAuthnSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Register a new device credential ────────────────────────────────────────

export async function registerDeviceCredential(
  userId: string,
  username: string,
  displayName: string,
  deviceName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'منصة الجوجالية',
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: username,
          displayName,
        },
        pubKeyCredParams: [
          { alg: -7,   type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
          requireResidentKey: true,
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'لم يتم إنشاء بيانات الجهاز.' };
    }

    const credentialIdBase64 = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    // Store in Supabase
    const { error: dbError } = await supabase
      .from('webauthn_credentials')
      .insert({
        user_id: userId,
        credential_id: credentialIdBase64,
        device_name: deviceName,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      if (dbError.code === '23505') {
        return { success: false, error: 'هذا الجهاز مسجّل بالفعل.' };
      }
      return { success: false, error: 'حدث خطأ أثناء حفظ بيانات الجهاز.' };
    }

    // Mark webauthn_enabled on user
    await supabase
      .from('users')
      .update({ webauthn_enabled: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return { success: true };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'تم إلغاء العملية أو انتهت مهلتها.' };
    }
    if (err?.name === 'InvalidStateError') {
      return { success: false, error: 'هذا الجهاز مسجّل بالفعل لحساب آخر.' };
    }
    return { success: false, error: 'تعذّر تسجيل هوية الجهاز.' };
  }
}

// ─── Authenticate with device credential ─────────────────────────────────────

/**
 * Returns the userId linked to the device credential if verification succeeds.
 * Returns null if the credential is not found in the DB (not linked to any account).
 */
export async function authenticateWithDevice(): Promise<{
  userId: string | null;
  error?: string;
}> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname,
        allowCredentials: [], // discoverable — browser picks the right one
      },
    }) as PublicKeyCredential | null;

    if (!assertion) {
      return { userId: null, error: 'لم يتم التحقق من الجهاز.' };
    }

    const credentialIdBase64 = btoa(
      String.fromCharCode(...new Uint8Array(assertion.rawId))
    );

    // Look up in DB
    const { data, error: dbError } = await supabase
      .from('webauthn_credentials')
      .select('user_id')
      .eq('credential_id', credentialIdBase64)
      .maybeSingle();

    if (dbError || !data) {
      return {
        userId: null,
        error: 'هوية جهازك غير مربوطة بأي حساب في منصة الجوجالية — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.',
      };
    }

    // Update last_used_at
    await supabase
      .from('webauthn_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialIdBase64);

    return { userId: data.user_id };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return {
        userId: null,
        error: 'هوية جهازك غير مربوطة بأي حساب في منصة الجوجالية (أو تم إلغاء التحقق) — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.',
      };
    }
    return {
      userId: null,
      error: 'تعذّر التحقق من هوية الجهاز — تأكد من تفعيل الميزة من إعدادات حسابك أولاً.',
    };
  }
}

// ─── List registered devices for a user ──────────────────────────────────────

export async function listUserDevices(userId: string): Promise<DeviceCredential[]> {
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('id, credential_id, device_name, created_at, last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    credentialId: row.credential_id,
    deviceName: row.device_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

// ─── Remove a device credential ───────────────────────────────────────────────

export async function removeDeviceCredential(
  credentialDbId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('webauthn_credentials')
    .delete()
    .eq('id', credentialDbId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: 'تعذّر حذف هوية الجهاز.' };
  }

  // Check if any credentials remain; if not, disable webauthn_enabled
  const { count } = await supabase
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) === 0) {
    await supabase
      .from('users')
      .update({ webauthn_enabled: false, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  return { success: true };
}

// ─── Detect device name heuristic ────────────────────────────────────────────

export function detectDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua))   return 'iPhone';
  if (/iPad/i.test(ua))     return 'iPad';
  if (/Android/i.test(ua))  return 'Android';
  if (/Mac/i.test(ua))      return 'Mac';
  if (/Windows/i.test(ua))  return 'Windows';
  if (/Linux/i.test(ua))    return 'Linux';
  return 'جهاز غير معروف';
}
