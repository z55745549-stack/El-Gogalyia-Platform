import React, { useState, useEffect } from 'react';
import { Megaphone, X, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { subscribeLatestAnnouncement, clearLatestAnnouncement } from '@/lib/database-service';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

export function BroadcastBanner() {
  const { userProfile } = useAuth();
  const { t } = useLanguage();
  const isLeader = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';
  const [announcement, setAnnouncement] = useState<{
    title: string;
    message: string;
    createdByName: string;
    createdAt?: any;
    active?: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = subscribeLatestAnnouncement((ann) => {
      setAnnouncement(ann);
      if (ann) {
        const annKey = `dismissed_ann_${ann.title}_${ann.createdByName}`;
        const isDismissed = localStorage.getItem(annKey) === 'true';
        setDismissed(isDismissed);
      }
    });
    return () => unsub();
  }, []);

  if (!announcement || dismissed) return null;

  const handleDismiss = () => {
    const annKey = `dismissed_ann_${announcement.title}_${announcement.createdByName}`;
    localStorage.setItem(annKey, 'true');
    setDismissed(true);
  };

  const handleEndBroadcastForAll = async () => {
    if (!window.confirm(t('broadcast.confirm_end', 'هل أنت متأكد من إنهاء هذه الإذاعة لجميع أعضاء المنصة؟'))) return;
    try {
      await clearLatestAnnouncement();
      toast.success(t('broadcast.ended_success', 'تم إنهاء الإذاعة بنجاح.'));
    } catch {
      toast.error(t('broadcast.ended_error', 'حدث خطأ أثناء إنهاء الإذاعة.'));
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary)]/15 via-cyan-500/10 to-amber-500/15 border-2 border-[var(--brand-primary)]/30 p-4 sm:p-5 shadow-lg backdrop-blur-md animate-fade-in mb-6">
      {/* Glow Effects */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--brand-primary)]/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-[var(--brand-primary)] text-white shadow-md shrink-0 animate-bounce">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {t('broadcast.official_broadcast', 'إذاعة رسمية عامة')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                {t('broadcast.by', 'بواسطة')}: {announcement.createdByName}
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-[var(--text-primary)] leading-tight">
              {announcement.title}
            </h4>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-w-4xl">
              {announcement.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {isLeader && (
            <button
              type="button"
              onClick={handleEndBroadcastForAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
              title={t('broadcast.end_for_all', 'إنهاء الإذاعة لجميع مستخدمي المنصة')}
            >
              {t('broadcast.end_button', 'إنهاء الإذاعة للجميع')}
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>{t('broadcast.mark_read', 'تمت القراءة')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
