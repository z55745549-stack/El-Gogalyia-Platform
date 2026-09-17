import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldX, LogOut, KeyRound, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AccessDenied() {
  const { signOut, userProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (!ownerUsername.trim() || !ownerPassword.trim()) {
      setPassError(t('access_denied.credentials_required', 'يرجى إدخال بيانات تفويض مالك المنصة.'));
      return;
    }

    if (!userProfile?.uid || !userProfile.email) return;
    setInitializing(true);

    try {
      const response = await fetch('/api/claim-owner-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUsername: ownerUsername.trim(),
          ownerPassword: ownerPassword.trim(),
          profile: {
            uid: userProfile.uid,
            username: userProfile.username,
            displayName: userProfile.displayName,
            email: userProfile.email,
            photoURL: userProfile.photoURL || '',
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || t('access_denied.claim_failed', 'تعذر تفعيل صلاحية المالك.'));
      }
      toast.success(t('access_denied.claim_success', 'تم التحقق بنجاح وتفعيل حسابك كـ LEAD!'));
      window.location.reload();
    } catch (err) {
      setPassError(err instanceof Error ? err.message : t('access_denied.claim_failed', 'تعذر تفعيل صلاحية المالك.'));
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans" style={{ background: 'var(--app-bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl p-8 sm:p-10 max-w-md w-full text-center space-y-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <ShieldX className="h-8 w-8" style={{ color: 'var(--brand-danger)' }} />
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('access_denied.title', 'Access Restricted')}</h1>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('access_denied.desc', 'هذا الحساب غير مضاف حالياً في لوحة الموظفين المصرح لهم بدخول النظام.')}
          </p>
        </div>

        {userProfile?.email && (
          <div className="p-3.5 rounded-2xl text-left" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
            <span className="text-[10px] block font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('access_denied.attempted', 'Attempted Account')}</span>
            <span className="text-xs font-mono font-bold break-all" style={{ color: 'var(--text-primary)' }}>{userProfile.email}</span>
          </div>
        )}

        {/* Master Owner Password Portal */}
        <form onSubmit={handleClaimAdmin} className="p-5 bg-slate-900 text-white rounded-2xl text-left space-y-4 shadow-lg border border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">{t('access_denied.owner_login', 'دخول صاحب المنصة (Platform Owner)')}</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {t('access_denied.owner_desc', 'إذا كنت مالك المنصة وتملك بيانات التفويض الخاصة، أدخلها أدناه لتفعيل حسابك فوراً كـ Admin.')}
          </p>

          <div className="space-y-1">
            <Input
              type="text"
              placeholder={t('access_denied.owner_username_placeholder', 'اسم تفويض المالك')}
              value={ownerUsername}
              onChange={(e) => setOwnerUsername(e.target.value)}
              leftIcon={<KeyRound className="h-4 w-4 text-slate-400" />}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 text-xs"
            />
            <Input
              type="password"
              placeholder={t('access_denied.owner_password_placeholder', 'كلمة مرور تفويض المالك')}
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 text-xs"
            />
            {passError && (
              <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" /> {passError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            loading={initializing}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 shadow-md shadow-blue-600/30"
          >
            <span>{t('access_denied.activate_admin', 'التحقق وتفعيل صلاحية الأدمن')}</span>
          </Button>
        </form>

        <div className="pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={handleSignOut} className="w-full gap-2 py-2.5 text-xs text-slate-600 font-semibold">
            <LogOut className="h-4 w-4" />
            <span>{t('access_denied.signout_other', 'تسجيل الخروج والمحاولة بحساب آخر')}</span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
