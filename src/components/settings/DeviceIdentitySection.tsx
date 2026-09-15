/**
 * DeviceIdentitySection — قسم هوية الجهاز في إعدادات الحساب
 * Available to all roles. Lets users register/remove their device biometric credentials.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Fingerprint, Plus, Trash2, ShieldCheck, ShieldOff,
  Smartphone, Monitor, Clock, AlertTriangle, CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  isWebAuthnSupported,
  registerDeviceCredential,
  listUserDevices,
  removeDeviceCredential,
  detectDeviceName,
  type DeviceCredential,
} from '@/lib/webauthn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'لم تُستخدم بعد';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function DeviceIcon({ name }: { name: string }) {
  const isPhone = /iphone|ipad|android/i.test(name);
  const Icon = isPhone ? Smartphone : Monitor;
  return <Icon className="h-4 w-4" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DeviceIdentitySection() {
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [supported, setSupported]           = useState<boolean | null>(null);
  const [devices, setDevices]               = useState<DeviceCredential[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [registering, setRegistering]       = useState(false);
  const [removingId, setRemovingId]         = useState<string | null>(null);
  const [deviceName, setDeviceName]         = useState('');
  const [showNameInput, setShowNameInput]   = useState(false);

  const userId = userProfile?.uid ?? '';

  // ── Load support + existing devices ──────────────────────────────────

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoadingDevices(true);
    const list = await listUserDevices(userId);
    setDevices(list);
    setLoadingDevices(false);
  }, [userId]);

  useEffect(() => {
    isWebAuthnSupported().then(setSupported);
    reload();
  }, [reload]);

  useEffect(() => {
    setDeviceName(detectDeviceName());
  }, []);

  // ── Register new device ───────────────────────────────────────────────

  async function handleRegister() {
    if (!userProfile) return;
    setRegistering(true);
    const result = await registerDeviceCredential(
      userId,
      userProfile.username,
      userProfile.displayName,
      deviceName.trim() || detectDeviceName()
    );
    setRegistering(false);

    if (result.success) {
      toast.success('تم ربط هوية الجهاز بحسابك بنجاح');
      setShowNameInput(false);
      reload();
    } else {
      toast.error(result.error ?? 'تعذّر تسجيل هوية الجهاز');
    }
  }

  // ── Remove device ─────────────────────────────────────────────────────

  async function handleRemove(credId: string) {
    setRemovingId(credId);
    const result = await removeDeviceCredential(credId, userId);
    setRemovingId(null);

    if (result.success) {
      toast.success('تم إزالة هوية الجهاز');
      reload();
    } else {
      toast.error(result.error ?? 'تعذّر حذف هوية الجهاز');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  const surface = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Fingerprint className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              هوية الجهاز
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              الدخول ببصمة الإصبع أو مستشعر الوجه أو قفل الشاشة
            </p>
          </div>
        </div>

        {/* Status badge */}
        {supported !== null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={
              devices.length > 0
                ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: isDark ? '#6EE7B7' : '#059669' }
                : supported
                ? { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: isDark ? '#A78BFA' : '#4F46E5' }
                : { background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', color: isDark ? '#94A3B8' : '#64748B' }
            }
          >
            {devices.length > 0 ? (
              <><ShieldCheck className="h-3 w-3" /> مفعّل</>
            ) : supported ? (
              <><ShieldOff className="h-3 w-3" /> غير مفعّل</>
            ) : (
              <><AlertTriangle className="h-3 w-3" /> غير مدعوم</>
            )}
          </div>
        )}
      </div>

      {/* Unsupported state */}
      {supported === false && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl text-sm"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-700 dark:text-amber-400">جهازك لا يدعم هذه الميزة</p>
            <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1 leading-relaxed">
              تتطلب هذه الميزة جهازاً يحتوي على مستشعر بصمة أو وجه، كما يجب استخدام متصفح حديث.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {supported && loadingDevices && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Device list */}
      {supported && !loadingDevices && (
        <div className="space-y-3">
          <AnimatePresence>
            {devices.map((device) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: surface, border: `1px solid ${border}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}
                  >
                    <DeviceIcon name={device.deviceName} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {device.deviceName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        آخر استخدام: {formatDate(device.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(device.id)}
                  disabled={removingId === device.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: 'rgba(244,63,94,0.07)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    color: isDark ? '#FDA4AF' : '#BE123C',
                    opacity: removingId === device.id ? 0.6 : 1,
                  }}
                >
                  {removingId === device.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                  إزالة
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty state */}
          {devices.length === 0 && (
            <div
              className="text-center py-8 rounded-2xl"
              style={{ background: surface, border: `1px dashed ${border}` }}
            >
              <Fingerprint className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                لم يتم ربط أي جهاز بعد
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                أضف هذا الجهاز لتتمكن من الدخول ببصمتك أو قفل الشاشة
              </p>
            </div>
          )}

          {/* Add device section */}
          <AnimatePresence mode="wait">
            {!showNameInput ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNameInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer"
                style={{
                  background: 'rgba(99,102,241,0.07)',
                  border: '1px dashed rgba(99,102,241,0.3)',
                  color: isDark ? '#A78BFA' : '#4F46E5',
                }}
              >
                <Plus className="h-4 w-4" />
                إضافة هذا الجهاز
              </motion.button>
            ) : (
              <motion.div
                key="name-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-3 p-4 rounded-2xl"
                style={{ background: surface, border: `1px solid rgba(99,102,241,0.25)` }}
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    اسم الجهاز (للتعرف عليه لاحقاً)
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="مثال: iPhone الخاص بي"
                    maxLength={40}
                    className={[
                      'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all',
                      'border border-slate-200 dark:border-white/[0.08]',
                      isDark ? 'bg-white/[0.04] text-white' : 'bg-slate-50 text-slate-900',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                      'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15',
                    ].join(' ')}
                    dir="auto"
                    autoFocus
                  />
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  سيطلب منك جهازك التحقق من هويتك عبر بصمة الإصبع أو مستشعر الوجه أو قفل الشاشة.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                      boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                      opacity: registering ? 0.7 : 1,
                    }}
                  >
                    {registering
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الربط...</>
                      : <><Fingerprint className="h-4 w-4" /> ربط الجهاز</>
                    }
                  </button>
                  <button
                    onClick={() => setShowNameInput(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                    style={{
                      background: surface,
                      border: `1px solid ${border}`,
                      color: isDark ? '#94A3B8' : '#64748B',
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Security note */}
      {supported && devices.length > 0 && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
          style={{
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            هوية جهازك مرتبطة بحسابك. يمكنك الآن الدخول مباشرةً دون الحاجة لكتابة كلمة المرور.
          </p>
        </div>
      )}
    </div>
  );
}
