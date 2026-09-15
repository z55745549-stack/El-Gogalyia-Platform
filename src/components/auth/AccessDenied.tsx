import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldX, LogOut, KeyRound, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MASTER_OWNER_KEY = 'oPPerationGDGG2$2182026';

export function AccessDenied() {
  const { signOut, userProfile } = useAuth();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (!passcode.trim()) {
      setPassError('يرجى إدخال رمز أمان مالك المنصة.');
      return;
    }

    if (passcode.trim() !== MASTER_OWNER_KEY) {
      setPassError('رمز الأمان غير صحيح! هذا الخيار مخصص لمالك المنصة فقط.');
      return;
    }

    if (!userProfile?.email) return;
    setInitializing(true);

    const adminProfile = {
      id: userProfile.uid,
      username: userProfile.username,
      display_name: userProfile.displayName || 'System Admin',
      email: userProfile.email.toLowerCase(),
      photo_url: userProfile.photoURL || null,
      role: 'lead',
      status: 'active',
      permissions: [
        'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
        'tasks.review', 'tasks.view_all', 'employees.view', 'employees.manage',
        'ocoins.manage', 'ocoins.view_all', 'reports.view', 'reports.export',
        'access.manage', 'activity.view', 'notifications.send'
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await supabase.from('users').upsert(adminProfile, { onConflict: 'id' });
    } catch (err) {
      console.warn('Supabase upsert notice:', err);
    }

    // Save local session override so admin access works immediately
    localStorage.setItem('elgogalyia_owner_admin', JSON.stringify({
      ...userProfile,
      role: 'lead',
    }));
    toast.success('تم التحقق بنجاح وتفعيل حسابك كـ LEAD!');
    window.location.reload();
    setInitializing(false);
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
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Access Restricted</h1>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            هذا الحساب غير مضاف حالياً في لوحة الموظفين المصرح لهم بدخول النظام.
          </p>
        </div>

        {userProfile?.email && (
          <div className="p-3.5 rounded-2xl text-left" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
            <span className="text-[10px] block font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Attempted Account</span>
            <span className="text-xs font-mono font-bold break-all" style={{ color: 'var(--text-primary)' }}>{userProfile.email}</span>
          </div>
        )}

        {/* Master Owner Password Portal */}
        <form onSubmit={handleClaimAdmin} className="p-5 bg-slate-900 text-white rounded-2xl text-left space-y-4 shadow-lg border border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">دخول صاحب المنصة (Platform Owner)</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            إذا كنت مالك المنصة وتملك رمز الأمان الخاص، أدخله أدناه لتفعيل حسابك فوراً كـ Admin.
          </p>

          <div className="space-y-1">
            <div className="relative">
              <Input
                type="password"
                placeholder="أدخل رمز أمان مالك المنصة..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 text-xs"
              />
            </div>
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
            <span>التحقق وتفعيل صلاحية الأدمن</span>
          </Button>
        </form>

        <div className="pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={handleSignOut} className="w-full gap-2 py-2.5 text-xs text-slate-600 font-semibold">
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج والمحاولة بحساب آخر</span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
