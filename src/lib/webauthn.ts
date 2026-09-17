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

// ─── Local device cache helper for maximum device resilience ───────────────
const LOCAL_DEVICES_KEY = 'elgogalyia_device_credentials';

function getLocalDevices(): Array<{ id: string; userId: string; credentialId: string; deviceName: string; createdAt: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDevice(dev: { id: string; userId: string; credentialId: string; deviceName: string; createdAt: string }) {
  try {
    const list = getLocalDevices().filter((d) => d.credentialId !== dev.credentialId);
    list.unshift(dev);
    localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Could not save local device credential:', e);
  }
}

function removeLocalDevice(credentialDbId: string, credIdBase64?: string) {
  try {
    const list = getLocalDevices().filter((d) => d.id !== credentialDbId && d.credentialId !== credIdBase64);
    localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Could not remove local device credential:', e);
  }
}

// ─── Support Check ────────────────────────────────────────────────────────────

export async function isWebAuthnSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential || !navigator?.credentials) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) return true;
    }
    // Universal fallback: if PublicKeyCredential exists on mobile browser, it's capable
    return true;
  } catch {
    return !!window.PublicKeyCredential;
  }
}

// ─── Register a new device credential ────────────────────────────────────────

export async function registerDeviceCredential(
  userId: string,
  username: string,
  displayName: string,
  deviceName: string
): Promise<{ success: boolean; error?: string }> {
  const encoder = new TextEncoder();
  const userIdHash = await crypto.subtle.digest('SHA-256', encoder.encode(userId));

  async function attemptCreate(usePlatformOnly: boolean): Promise<PublicKeyCredential | null> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const authSelection: AuthenticatorSelectionCriteria = {
      userVerification: 'preferred',
      residentKey: 'preferred',
    };
    if (usePlatformOnly) {
      authSelection.authenticatorAttachment = 'platform';
    }

    return await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'منصة الجوجالية',
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array(userIdHash),
          name: username || 'user',
          displayName: displayName || username || 'عضو المنصة',
        },
        pubKeyCredParams: [
          { alg: -7,   type: 'public-key' }, // ES256 (Supported by 100% of Android, iOS, Windows, Mac)
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: authSelection,
        timeout: 60000,
        attestation: 'none', // Essential for non-enterprise Android phones (Xiaomi, Samsung, etc.)
      },
    }) as PublicKeyCredential | null;
  }

  let credential: PublicKeyCredential | null = null;
  try {
    credential = await attemptCreate(true);
  } catch (primaryErr: any) {
    if (primaryErr?.name === 'NotAllowedError') {
      return { success: false, error: 'تم إلغاء عملية البصمة أو انتهت مهلتها من الجهاز.' };
    }
    // Android Credential Manager retry without strict platform attachment
    try {
      credential = await attemptCreate(false);
    } catch (fallbackErr: any) {
      if (fallbackErr?.name === 'NotAllowedError') {
        return { success: false, error: 'تم إلغاء عملية البصمة أو قفل الشاشة.' };
      }
      if (fallbackErr?.name === 'InvalidStateError') {
        return { success: false, error: 'هذا الجهاز مسجّل بالفعل لحساب آخر.' };
      }
      return {
        success: false,
        error: 'تعذّر الاتصال بمدير بيانات الاعتماد بالهاتف. يرجى التأكد من تفعيل قفل الشاشة (بصمة أو نمط أو PIN) في إعدادات الهاتف.',
      };
    }
  }

  if (!credential) {
    return { success: false, error: 'لم يتم إنشاء بيانات اعتماد الجهاز.' };
  }

  try {
    const credentialIdBase64 = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    const dbId = 'cred_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

    // 1. Save locally on the device immediately for instant offline biometric match
    saveLocalDevice({
      id: dbId,
      userId,
      credentialId: credentialIdBase64,
      deviceName,
      createdAt: new Date().toISOString(),
    });

    // 2. Store in Supabase
    try {
      await supabase
        .from('webauthn_credentials')
        .insert({
          id: dbId,
          user_id: userId,
          credential_id: credentialIdBase64,
          device_name: deviceName,
          created_at: new Date().toISOString(),
        });
    } catch (dbErr) {
      console.warn('Supabase webauthn_credentials save notice:', dbErr);
    }

    // 3. Mark webauthn_enabled on user in Supabase
    try {
      await supabase
        .from('users')
        .update({ webauthn_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (uErr) {
      console.warn('Supabase users webauthn_enabled update notice:', uErr);
    }

    return { success: true };
  } catch (saveErr: any) {
    return { success: false, error: saveErr?.message || 'تعذّر حفظ بيانات الجهاز.' };
  }
}

// ─── Authenticate with device credential ─────────────────────────────────────

/**
 * Returns the userId linked to the device credential if verification succeeds.
 * Returns null if the credential is not found in the DB or local cache.
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
        userVerification: 'preferred', // Flexible user verification
        rpId: window.location.hostname,
        allowCredentials: [], // discoverable passkey
      },
    }) as PublicKeyCredential | null;

    if (!assertion) {
      return { userId: null, error: 'لم يتم التحقق من هوية وبصمة الجهاز.' };
    }

    const credentialIdBase64 = btoa(
      String.fromCharCode(...new Uint8Array(assertion.rawId))
    );

    // 1. Look up in Supabase
    let matchedUserId: string | null = null;
    try {
      const { data, error: dbError } = await supabase
        .from('webauthn_credentials')
        .select('user_id')
        .eq('credential_id', credentialIdBase64)
        .maybeSingle();

      if (!dbError && data?.user_id) {
        matchedUserId = data.user_id;
      }
    } catch (e) {
      console.warn('Supabase credential lookup notice:', e);
    }

    // 2. Fallback to local device cache if Supabase didn't have it or network was slow
    if (!matchedUserId) {
      const local = getLocalDevices().find((d) => d.credentialId === credentialIdBase64);
      if (local) {
        matchedUserId = local.userId;
      }
    }

    if (!matchedUserId) {
      return {
        userId: null,
        error: 'هوية وبصمة هذا الهاتف غير مربوطة بأي حساب في منصة الجوجالية — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.',
      };
    }

    // Update last_used_at in background
    void supabase
      .from('webauthn_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialIdBase64);

    return { userId: matchedUserId };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return {
        userId: null,
        error: 'تم إلغاء المصادقة البيومترية من الهاتف أو لم يتم التعرف على البصمة.',
      };
    }
    return {
      userId: null,
      error: 'تعذّر التحقق من بصمة الجهاز — تأكد من تفعيل الميزة من إعدادات الحساب أولاً.',
    };
  }
}

// ─── List registered devices for a user ──────────────────────────────────────

export async function listUserDevices(userId: string): Promise<DeviceCredential[]> {
  const localList = getLocalDevices().filter((d) => d.userId === userId);
  const itemsMap = new Map<string, DeviceCredential>();

  // Add local devices first
  for (const loc of localList) {
    itemsMap.set(loc.credentialId, {
      id: loc.id,
      credentialId: loc.credentialId,
      deviceName: loc.deviceName,
      createdAt: loc.createdAt,
      lastUsedAt: null,
    });
  }

  try {
    const { data, error } = await supabase
      .from('webauthn_credentials')
      .select('id, credential_id, device_name, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      for (const row of data) {
        itemsMap.set(row.credential_id, {
          id: row.id,
          credentialId: row.credential_id,
          deviceName: row.device_name,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
        });
      }
    }
  } catch (e) {
    console.warn('Supabase listUserDevices notice:', e);
  }

  return Array.from(itemsMap.values());
}

// ─── Remove a device credential ───────────────────────────────────────────────

export async function removeDeviceCredential(
  credentialDbId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  removeLocalDevice(credentialDbId);

  try {
    await supabase
      .from('webauthn_credentials')
      .delete()
      .eq('id', credentialDbId)
      .eq('user_id', userId);
  } catch (e) {
    console.warn('Supabase removeDeviceCredential notice:', e);
  }

  // Check if any credentials remain; if not, disable webauthn_enabled
  const remainingLocals = getLocalDevices().filter((d) => d.userId === userId);
  let hasRemaining = remainingLocals.length > 0;

  try {
    const { count } = await supabase
      .from('webauthn_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count ?? 0) > 0) hasRemaining = true;
  } catch {}

  if (!hasRemaining) {
    try {
      await supabase
        .from('users')
        .update({ webauthn_enabled: false, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch {}
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
