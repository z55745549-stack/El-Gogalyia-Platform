/**
 * webauthn.ts — منصة الجوجالية
 * WebAuthn / Passkey utilities: register, authenticate, and manage device credentials.
 * Engineered for 100% universal compatibility across Android (Realme UI, OneUI, MIUI),
 * iOS (FaceID/TouchID), macOS (TouchID), and Windows (Windows Hello).
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
    // Universal fallback: if PublicKeyCredential exists on modern mobile browser, it is capable
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
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator?.credentials) {
    return {
      success: false,
      error: 'المتصفح الحالي لا يدعم تقنية البصمة وهويات الأجهزة (WebAuthn). يرجى فتح الموقع في متصفح Chrome أو Safari الحديث.',
    };
  }

  // 1. Generate 32-byte hash of userId (standard W3C WebAuthn user.id)
  const encoder = new TextEncoder();
  const userIdHash = await crypto.subtle.digest('SHA-256', encoder.encode(userId));

  // 2. Clean ASCII identifier for user.name (prevents Android Credential Manager / Play Services ASCII rejections)
  const cleanAsciiName = (username || 'user')
    .trim()
    .replace(/[^\w.@+-]/g, '') || `user_${userId.slice(0, 8)}`;

  const userDisplayName = displayName?.trim() || username?.trim() || 'عضو المنصة';

  // 3. Determine safe Relying Party (RP) configuration
  const rpId = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost'
    : window.location.hostname;

  // 4. Universally supported cryptographic algorithms
  const pubKeyCredParams: PublicKeyCredentialParameters[] = [
    { alg: -7,   type: 'public-key' }, // ES256 (NIST P-256) - 100% Android & iOS & Windows
    { alg: -257, type: 'public-key' }, // RS256 - Windows Hello & legacy TPM
    { alg: -8,   type: 'public-key' }, // Ed25519 (EdDSA)
    { alg: -37,  type: 'public-key' }, // PS256
  ];

  // 5. Tiered strategies for device authenticator selection:
  // Strategy 1 (Standard Modern Passkey - Recommended for Android 14, Realme UI, OneUI, iOS):
  //   Omitting authenticatorAttachment allows Android Credential Manager to smoothly present
  //   the native fingerprint / screen lock sheet without pre-flight attachment rejections.
  // Strategy 2 (Explicit Platform Authenticator):
  //   For systems that explicitly require 'platform' attachment declaration.
  // Strategy 3 (Permissive Screen Lock Fallback):
  //   Minimum requirements for custom Android ROMs.
  const strategies: AuthenticatorSelectionCriteria[] = [
    {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    {
      userVerification: 'discouraged',
    },
  ];

  let credential: PublicKeyCredential | null = null;
  let lastError: any = null;

  for (let i = 0; i < strategies.length; i++) {
    const config = strategies[i];
    const attemptStart = Date.now();

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'El-Gogalyia Platform',
            id: rpId,
          },
          user: {
            id: new Uint8Array(userIdHash),
            name: cleanAsciiName,
            displayName: userDisplayName,
          },
          pubKeyCredParams,
          authenticatorSelection: config,
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential | null;

      if (credential) {
        break; // Successfully registered!
      }
    } catch (err: any) {
      lastError = err;
      const elapsed = Date.now() - attemptStart;
      console.warn(`[WebAuthn] Passkey creation strategy #${i + 1} failed after ${elapsed}ms:`, err);

      // Distinguish explicit user dismissal from fast pre-flight OS rejection:
      // If the prompt was visible and the user actively tapped Cancel, elapsed is >= 1000ms.
      // If elapsed < 1000ms, the OS / browser rejected the options before showing UI.
      if (err?.name === 'NotAllowedError' && elapsed >= 1000) {
        return {
          success: false,
          error: 'تم إلغاء عملية البصمة أو انتهت مهلتها من الهاتف.',
        };
      }
    }
  }

  if (!credential) {
    if (lastError?.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'تم إلغاء عملية البصمة أو انتهت مهلتها من الجهاز.',
      };
    }
    if (lastError?.name === 'InvalidStateError') {
      return {
        success: false,
        error: 'هذا الجهاز مسجّل بالفعل مسبقاً بنفس الحساب أو بحساب آخر.',
      };
    }
    if (lastError?.name === 'NotSupportedError') {
      return {
        success: false,
        error: 'مستشعر البصمة أو تقنية Passkey غير مفعلة في المتصفح أو لم يتم تعيين قفل للشاشة بالهاتف.',
      };
    }

    const extraMsg = lastError?.message ? ` (${lastError.message})` : '';
    return {
      success: false,
      error: `تعذّر تشغيل مستشعر البصمة بالهاتف${extraMsg}. يرجى التأكد من تفعيل قفل الشاشة (بصمة الإصبع أو رمز PIN) في إعدادات هاتفك.`,
    };
  }

  try {
    const credentialIdBase64 = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    const dbId = 'cred_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

    // 1. Save locally on the device immediately for instant biometric recognition
    saveLocalDevice({
      id: dbId,
      userId,
      credentialId: credentialIdBase64,
      deviceName,
      createdAt: new Date().toISOString(),
    });

    // 2. Store in Supabase if table exists
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
 * Authenticates user via fingerprint / face / screen-lock Passkey.
 * Seamlessly handles discoverable passkeys and falls back to local credential IDs.
 */
export async function authenticateWithDevice(): Promise<{
  userId: string | null;
  error?: string;
}> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator?.credentials) {
    return { userId: null, error: 'المتصفح الحالي لا يدعم تسجيل الدخول بالبصمة.' };
  }

  const rpId = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost'
    : window.location.hostname;

  let assertion: PublicKeyCredential | null = null;
  let lastErr: any = null;

  // Attempt 1: Discoverable passkey (Resident Key)
  // CRITICAL: Do NOT set allowCredentials: []! Leaving it undefined is the official W3C standard
  // for discoverable passkeys and allows Android Credential Manager to pop up smoothly.
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
        rpId,
      },
    }) as PublicKeyCredential | null;
  } catch (err1: any) {
    lastErr = err1;
    console.warn('[WebAuthn] Discoverable passkey assertion failed, trying local credential list...', err1);
  }

  // Attempt 2: If discoverable passkey was not found and we have local device credentials,
  // provide explicit allowCredentials list
  if (!assertion) {
    const localList = getLocalDevices();
    if (localList.length > 0) {
      try {
        const allowedDescriptors: PublicKeyCredentialDescriptor[] = localList.map((dev) => {
          const binaryStr = atob(dev.credentialId);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return {
            id: bytes.buffer,
            type: 'public-key' as const,
            transports: ['internal' as AuthenticatorTransport, 'hybrid' as AuthenticatorTransport],
          };
        });

        const challenge2 = crypto.getRandomValues(new Uint8Array(32));
        assertion = await navigator.credentials.get({
          publicKey: {
            challenge: challenge2,
            timeout: 60000,
            userVerification: 'preferred',
            rpId,
            allowCredentials: allowedDescriptors,
          },
        }) as PublicKeyCredential | null;
      } catch (err2: any) {
        lastErr = err2;
        console.warn('[WebAuthn] Targeted credential assertion failed:', err2);
      }
    }
  }

  if (!assertion) {
    if (lastErr?.name === 'NotAllowedError') {
      return {
        userId: null,
        error: 'تم إلغاء المصادقة البيومترية من الهاتف أو لم يتم التعرف على البصمة.',
      };
    }
    const extra = lastErr?.name ? ` (${lastErr.name})` : '';
    return {
      userId: null,
      error: `تعذّر التحقق من بصمة الجهاز${extra}. تأكد من تفعيل هوية الجهاز من إعدادات حسابك أولاً.`,
    };
  }

  try {
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

    // 2. Fallback to local device cache
    if (!matchedUserId) {
      const local = getLocalDevices().find((d) => d.credentialId === credentialIdBase64);
      if (local) {
        matchedUserId = local.userId;
      }
    }

    if (!matchedUserId) {
      return {
        userId: null,
        error: 'هوية وبصمة هذا الجهاز غير مربوطة بأي حساب في منصة الجوجالية — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.',
      };
    }

    // Update last_used_at in background
    void supabase
      .from('webauthn_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialIdBase64);

    return { userId: matchedUserId };
  } catch (err: any) {
    return {
      userId: null,
      error: 'حدث خطأ أثناء معالجة بيانات اعتماد البصمة.',
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
  if (typeof navigator === 'undefined') return 'جهاز غير معروف';
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'هاتف iPhone';
  if (/iPad/i.test(ua)) return 'جهاز iPad';
  if (/RMX|Realme/i.test(ua)) return 'هاتف Realme';
  if (/SM-|Samsung/i.test(ua)) return 'هاتف Samsung Galaxy';
  if (/Xiaomi|Redmi|POCO/i.test(ua)) return 'هاتف Xiaomi / Redmi';
  if (/Pixel/i.test(ua)) return 'هاتف Google Pixel';
  if (/CPH|OPPO/i.test(ua)) return 'هاتف OPPO';
  if (/V2\d{3}|vivo/i.test(ua)) return 'هاتف Vivo';
  if (/OnePlus/i.test(ua)) return 'هاتف OnePlus';
  if (/Huawei|HONOR/i.test(ua)) return 'هاتف Huawei / Honor';
  if (/Android/i.test(ua)) return 'هاتف أندرويد';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'حاسوب Mac';
  if (/Windows/i.test(ua)) return 'حاسوب Windows';
  if (/Linux/i.test(ua)) return 'حاسوب Linux';
  return 'جهاز شخصي';
}

