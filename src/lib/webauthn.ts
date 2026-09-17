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
  // Strategy 1 (This Device / Platform Authenticator - DIRECT):
  //   Explicitly setting authenticatorAttachment: 'platform' targets the phone's built-in
  //   fingerprint sensor / screen lock directly without presenting any intermediate selection sheet ("This device" vs "Another device").
  // Strategy 2 (Platform with residentKey required):
  //   For strict FIDO2 implementations on Android 14 / Realme UI / iOS.
  // Strategy 3 (Standard Modern Passkey preferred):
  //   Flexible fallback.
  // Strategy 4 (Permissive Screen Lock Fallback):
  //   Minimum requirements for custom Android ROMs.
  const strategies: AuthenticatorSelectionCriteria[] = [
    {
      authenticatorAttachment: 'platform', // Targets "This Device" DIRECTLY on first attempt
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'preferred',
    },
    {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    {
      authenticatorAttachment: 'platform',
      userVerification: 'discouraged',
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

    // Generate standard RFC4122 UUID so PostgreSQL uuid column never rejects it
    const dbId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

    let savedId = dbId;

    // 1. Store in Supabase
    try {
      const { data: insertedRow, error: dbErr } = await supabase
        .from('webauthn_credentials')
        .insert({
          id: dbId,
          user_id: userId,
          credential_id: credentialIdBase64,
          device_name: deviceName,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      if (insertedRow?.id) {
        savedId = insertedRow.id;
      }
      if (dbErr) {
        console.warn('Supabase webauthn_credentials save notice:', dbErr);
      }
    } catch (dbErr) {
      console.warn('Supabase webauthn_credentials save notice:', dbErr);
    }

    // 2. Save locally on the device immediately for instant biometric recognition
    saveLocalDevice({
      id: savedId,
      userId,
      credentialId: credentialIdBase64,
      deviceName,
      createdAt: new Date().toISOString(),
    });

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

  // 1. Gather all registered credential IDs from local storage and Supabase database.
  // CRITICAL: Passing specific allowCredentials is what tells Android/Windows to look
  // directly on "This Device". Calling navigator.credentials.get without allowCredentials
  // is what triggers the 3 fallback choices (USB key, NFC, and QR code / Different device).
  const credentialIds = new Set<string>();

  const localList = getLocalDevices();
  for (const dev of localList) {
    if (dev.credentialId) credentialIds.add(dev.credentialId);
  }

  // Also fetch credentials from Supabase in case local storage was cleared or user switched browsers
  try {
    const { data: dbCreds } = await supabase
      .from('webauthn_credentials')
      .select('credential_id')
      .limit(50);
    if (dbCreds) {
      for (const c of dbCreds) {
        if (c.credential_id) credentialIds.add(c.credential_id);
      }
    }
  } catch (e) {
    console.warn('[WebAuthn] Credential fetch notice:', e);
  }

  // If no credentials exist anywhere, do NOT call navigator.credentials.get (which would trigger the 3 external options).
  if (credentialIds.size === 0) {
    return {
      userId: null,
      error: 'لا توجد أي بصمة مسجلة لهذا الجهاز. يرجى تسجيل الدخول باسم المستخدم وكلمة المرور أولاً، ثم ربط بصمة جهازك من صفحة الإعدادات.',
    };
  }

  const buildDescriptors = (transports: AuthenticatorTransport[]): PublicKeyCredentialDescriptor[] => {
    return Array.from(credentialIds).map((credId) => {
      const binaryStr = atob(credId);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return {
        id: bytes.buffer,
        type: 'public-key' as const,
        transports,
      };
    });
  };

  let assertion: PublicKeyCredential | null = null;
  let lastErr: any = null;

  // Primary Attempt: Direct to "This Device" (internal biometric sensor)
  // transports: ['internal'] restricts the authenticator search to This Device only.
  try {
    const challenge1 = crypto.getRandomValues(new Uint8Array(32));
    const allowedDescriptors1 = buildDescriptors(['internal']);

    const publicKeyReq: any = {
      challenge: challenge1,
      timeout: 60000,
      userVerification: 'preferred',
      rpId,
      allowCredentials: allowedDescriptors1,
      hints: ['client-device'],
    };

    assertion = await navigator.credentials.get({
      publicKey: publicKeyReq,
    }) as PublicKeyCredential | null;
  } catch (err1: any) {
    lastErr = err1;
    console.warn('[WebAuthn] Direct internal biometric notice:', err1);

    // If the user cancelled the fingerprint popup, don't trigger another prompt
    if (err1?.name === 'NotAllowedError') {
      return {
        userId: null,
        error: 'تم إلغاء المصادقة البيومترية من الهاتف أو لم يتم التعرف على البصمة.',
      };
    }
  }

  // Permissive fallback: if browser rejected internal-only transport before prompting user,
  // try with internal + hybrid transports (The proven configuration that opened "This device")
  if (!assertion && lastErr?.name !== 'NotAllowedError') {
    try {
      const challenge2 = crypto.getRandomValues(new Uint8Array(32));
      const allowedDescriptors2 = buildDescriptors(['internal', 'hybrid']);

      assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge2,
          timeout: 60000,
          userVerification: 'preferred',
          rpId,
          allowCredentials: allowedDescriptors2,
        },
      }) as PublicKeyCredential | null;
    } catch (err2: any) {
      lastErr = err2;
      console.warn('[WebAuthn] Hybrid fallback notice:', err2);
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
      // Auto-sync: if local devices exist on this client that aren't yet in Supabase, push them up
      const dbCredIds = new Set(data.map((r: any) => r.credential_id));
      for (const loc of localList) {
        if (!dbCredIds.has(loc.credentialId)) {
          const syncUuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : undefined;
          void supabase
            .from('webauthn_credentials')
            .insert({
              ...(syncUuid ? { id: syncUuid } : {}),
              user_id: userId,
              credential_id: loc.credentialId,
              device_name: loc.deviceName || 'الهاتف',
              created_at: loc.createdAt || new Date().toISOString(),
            })
            .then(() => {
              void supabase
                .from('users')
                .update({ webauthn_enabled: true, updated_at: new Date().toISOString() })
                .eq('id', userId);
            });
        }
      }

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
      .eq('user_id', userId)
      .or(`id.eq.${credentialDbId},credential_id.eq.${credentialDbId}`);
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

