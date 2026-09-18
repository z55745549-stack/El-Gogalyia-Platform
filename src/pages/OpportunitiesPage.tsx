import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Sparkles,
  Search,
  Plus,
  ExternalLink,
  Calendar,
  Clock,
  Building2,
  Trash2,
  Edit,
  Copy,
  Check,
  Briefcase,
  Award,
  BookOpen,
  Trophy,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/utils/permissions';
import {
  subscribeOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityCountdown,
} from '@/lib/opportunities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDate, cn } from '@/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '@/types';
// 2-Step admin auth removed — Lead/Co-Lead/Head act directly

const getCategoryBadge = (category: OpportunityCategory, lang: string = 'ar') => {
  switch (category) {
    case 'training':
      return {
        label: lang === 'en' ? 'Training Program' : 'برنامج تدريبي',
        classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
      };
    case 'job':
      return {
        label: lang === 'en' ? 'Job Opportunity' : 'فرصة عمل',
        classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
      };
    case 'scholarship':
      return {
        label: lang === 'en' ? 'Scholarship' : 'منحة دراسية',
        classes: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
      };
    case 'workshop':
      return {
        label: lang === 'en' ? 'Workshop' : 'ورشة عمل',
        classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
      };
    case 'competition':
      return {
        label: lang === 'en' ? 'Competition / Hackathon' : 'مسابقة / هاكاثون',
        classes: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
      };
    default:
      return {
        label: lang === 'en' ? 'Opportunity' : 'فرصة',
        classes: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
      };
  }
};

export function OpportunitiesPage() {
  const { userProfile } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const isAdmin = userProfile ? isAdminRole(userProfile.role) : false;

  const CATEGORIES = [
    { value: 'all', label: t('opportunities.cat_all'), icon: GraduationCap },
    { value: 'training', label: t('opportunities.cat_training'), icon: BookOpen },
    { value: 'job', label: t('opportunities.cat_job'), icon: Briefcase },
    { value: 'scholarship', label: t('opportunities.cat_scholarship'), icon: Award },
    { value: 'workshop', label: t('opportunities.cat_workshop'), icon: Sparkles },
    { value: 'competition', label: t('opportunities.cat_competition'), icon: Trophy },
  ];

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form inputs
  const [formTitle, setFormTitle] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRequirements, setFormRequirements] = useState('');
  const [formApplicationUrl, setFormApplicationUrl] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formCategory, setFormCategory] = useState<OpportunityCategory>('training');

  useEffect(() => {
    const unsub = subscribeOpportunities((list) => {
      setOpportunities(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openCreateModal = () => {
    setEditingOpportunity(null);
    setFormTitle('');
    setFormProvider('');
    setFormDescription('');
    setFormRequirements('');
    setFormApplicationUrl('');
    // Default deadline 2 weeks ahead
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    setFormDeadline(twoWeeks.toISOString().split('T')[0]);
    setFormCategory('training');
    setShowCreateModal(true);
  };

  const openEditModal = (opp: Opportunity) => {
    setEditingOpportunity(opp);
    setFormTitle(opp.title);
    setFormProvider(opp.provider);
    setFormDescription(opp.description);
    setFormRequirements(opp.requirements || '');
    setFormApplicationUrl(opp.applicationUrl);
    try {
      const d = opp.deadline ? (opp.deadline as any).toDate ? (opp.deadline as any).toDate() : new Date(opp.deadline as any) : new Date();
      setFormDeadline(d.toISOString().split('T')[0]);
    } catch {
      setFormDeadline('');
    }
    setFormCategory(opp.category);
    setShowCreateModal(true);
  };

  const executeSaveOpportunity = async () => {
    setSubmitting(true);
    try {
      const deadlineDate = new Date(formDeadline);

      if (editingOpportunity) {
        await updateOpportunity(
          editingOpportunity.id,
          {
            title: formTitle.trim(),
            provider: formProvider.trim(),
            description: formDescription.trim(),
            requirements: formRequirements.trim(),
            applicationUrl: formApplicationUrl.trim(),
            deadline: deadlineDate.toISOString(),
            category: formCategory,
          },
          {
            email: userProfile?.email || userProfile?.username || '',
            displayName: userProfile?.displayName || 'Admin',
          }
        );
        toast.success('تم تحديث بيانات الفرصة بنجاح! ✨');
      } else {
        await createOpportunity(
          {
            title: formTitle.trim(),
            provider: formProvider.trim(),
            description: formDescription.trim(),
            requirements: formRequirements.trim(),
            applicationUrl: formApplicationUrl.trim(),
            deadline: deadlineDate,
            category: formCategory,
          },
          {
            uid: userProfile?.uid || '',
            email: userProfile?.email || userProfile?.username || '',
            displayName: userProfile?.displayName || 'Admin',
          }
        );
        toast.success('تم نشر الفرصة الجديدة بنجاح وإشعار أعضاء الفريق! 🎓🚀');
      }

      setShowCreateModal(false);
      setEditingOpportunity(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ الفرصة.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formProvider.trim() || !formApplicationUrl.trim() || !formDeadline) {
      toast.error('يرجى ملء كافة الحقول الإلزامية (اسم الفرصة، الجهة المقدمة، رابط التقديم، والموعد النهائي).');
      return;
    }

    if (editingOpportunity) {
      // Direct update for existing
      await executeSaveOpportunity();
    } else {
      // Direct creation — no 2-step verification required
      await executeSaveOpportunity();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await deleteOpportunity(deleteTarget.id, deleteTarget.title, {
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم حذف الفرصة بنجاح.');
      if (selectedOpportunity?.id === deleteTarget.id) setSelectedOpportunity(null);
      setDeleteTarget(null);
    } catch {
      toast.error('فشل حذف الفرصة.');
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('تم نسخ رابط التقديم إلى الحافظة! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter list with memoization for snappy performance
  const filteredOpportunities = useMemo(() => {
    const queryStr = search.toLowerCase().trim();
    return opportunities.filter((opp) => {
      const matchSearch =
        !queryStr ||
        opp.title.toLowerCase().includes(queryStr) ||
        opp.provider.toLowerCase().includes(queryStr) ||
        opp.description.toLowerCase().includes(queryStr);

      const matchCategory = selectedCategory === 'all' || opp.category === selectedCategory;

      const countdown = getOpportunityCountdown(opp.deadline);
      let matchStatus = true;
      if (statusFilter === 'active') matchStatus = !countdown.isExpired;
      if (statusFilter === 'expired') matchStatus = countdown.isExpired;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [opportunities, search, selectedCategory, statusFilter]);

  return (
    <div className={cn("space-y-6 font-sans", isRTL ? "text-right dir-rtl" : "text-left")}>
      {/* Top Hero Banner */}
      <div className="card card-glass mesh-bg rounded-3xl p-6 sm:p-8 text-[var(--text-primary)] relative overflow-hidden shadow-lg border border-[var(--brand-primary)]/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl badge-accent font-black text-xs mb-2.5 backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('opportunities.exclusive_badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text-primary)]">
              {t('opportunities.hero_title')}
            </h1>
            <p className="text-[var(--text-secondary)] text-xs sm:text-sm mt-1.5 font-bold max-w-2xl leading-relaxed">
              {t('opportunities.hero_desc')}
            </p>
          </div>

          {isAdmin && (
            <Button
              onClick={openCreateModal}
              className="btn-primary border-none shadow-xl font-black text-xs sm:text-sm py-3 px-6 rounded-2xl gap-2 cursor-pointer shrink-0"
            >
              <Plus className="h-5 w-5" />
              <span>{t('opportunities.post_new')}</span>
            </Button>
          )}
        </div>
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-[var(--brand-accent)]/15 blur-3xl pointer-events-none" />
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="space-y-3 bg-white dark:bg-[#130d29] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#291f4a] shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400", isRTL ? "right-3.5" : "left-3.5")} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('opportunities.search_placeholder')}
              className={cn(
                "form-input py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#1a1336] border-slate-200 dark:border-[#2f2454] rounded-xl w-full",
                isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
              {language === 'en' ? 'Status:' : 'الحالة:'}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1a1336] p-1 rounded-xl border border-slate-200 dark:border-[#2f2454] w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex-1 sm:flex-initial text-center',
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-[#271d4a] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                )}
              >
                {t('opportunities.tab_all')}
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex-1 sm:flex-initial text-center',
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-[#271d4a] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                )}
              >
                {t('opportunities.tab_active')}
              </button>
              <button
                onClick={() => setStatusFilter('expired')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex-1 sm:flex-initial text-center',
                  statusFilter === 'expired'
                    ? 'bg-white dark:bg-[#271d4a] text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                )}
              >
                {t('opportunities.tab_expired')}
              </button>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto gap-2 pt-2 border-t border-slate-100 dark:border-white/5 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-150 cursor-pointer border',
                  isSelected
                    ? 'bg-[#FF3483] text-white border-[#FF3483] shadow-sm'
                    : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-[#2a204e] hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-white' : 'text-slate-400')} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Opportunity Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="bg-white dark:bg-[#130d29] rounded-2xl border border-slate-200/80 dark:border-[#291f4a] p-12 text-center">
          <EmptyState
            icon={<GraduationCap className="h-10 w-10 text-[var(--brand-accent)]" />}
            title={t('opportunities.empty_title')}
            description={t('opportunities.empty_desc')}
            action={
              isAdmin ? (
                <Button onClick={openCreateModal} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> {t('opportunities.post_new')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOpportunities.map((opp) => {
            const categoryBadge = getCategoryBadge(opp.category, language);
            const countdown = getOpportunityCountdown(opp.deadline);

            return (
              <motion.div
                key={opp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md hover:border-[var(--brand-accent)]/50 transition-all duration-200 flex flex-col justify-between overflow-hidden relative group"
              >
                {/* Header Badge Row */}
                <div className="p-5 pb-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={cn('badge text-[11px] font-black border px-2.5 py-0.5 rounded-lg', categoryBadge.classes)}>
                      {categoryBadge.label}
                    </span>

                    <span
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1',
                        countdown.isExpired
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                          : countdown.days <= 3
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 animate-pulse'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {countdown.label}
                    </span>
                  </div>

                  {/* Title & Provider */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug group-hover:text-[var(--brand-accent)] transition-colors line-clamp-2">
                      {opp.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{opp.provider}</span>
                    </div>
                  </div>

                  {/* Special Team Exclusive Badge / Container */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-400/15 dark:via-amber-400/5 border border-amber-500/30 dark:border-amber-400/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0 animate-pulse" />
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                        {language === 'en' ? 'Team members only 🔒' : 'مخصص لأعضاء الفريق فقط 🔒'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200">
                      {language === 'en' ? 'Exclusive' : 'فرصة حصرية'}
                    </span>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {opp.description}
                  </p>
                </div>

                {/* Card Footer & Action Buttons */}
                <div className="p-4 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-[#221a44] flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setSelectedOpportunity(opp)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs font-bold py-2 border-slate-200 dark:border-white/10 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] rounded-xl"
                  >
                    {language === 'en' ? 'View Full Details' : 'عرض التفاصيل الكاملة'}
                  </Button>

                  <a
                    href={opp.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-[var(--brand-accent)] text-slate-950 hover:opacity-90 transition-opacity shadow-xs"
                    title="فتح رابط التقديم"
                  >
                    <ExternalLink className="h-4 w-4 font-bold" />
                  </a>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(opp)}
                        className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-[#251d45] text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                        title="تعديل الفرصة"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(opp)}
                        className="p-2 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        title="حذف الفرصة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedOpportunity && (
        <Modal
          open={!!selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          title={selectedOpportunity.title}
          size="lg"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink(selectedOpportunity.applicationUrl)}
                className="w-full sm:w-auto gap-1.5 text-xs rounded-xl"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied
                  ? (language === 'en' ? 'Copied!' : 'تم النسخ!')
                  : (language === 'en' ? 'Copy Application Link' : 'نسخ رابط التقديم')}
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedOpportunity(null)}
                  className="flex-1 sm:flex-initial text-xs rounded-xl"
                >
                  {language === 'en' ? 'Close' : 'إغلاق'}
                </Button>
                <a
                  href={selectedOpportunity.applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl btn-primary font-black text-xs transition-all shadow-md"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{language === 'en' ? 'Apply for Opportunity Now 🚀' : 'التقديم على الفرصة الآن 🚀'}</span>
                </a>
              </div>
            </div>
          }
        >
          <div className={cn("space-y-5 font-sans", isRTL ? "text-right dir-rtl" : "text-left")}>
            {/* Badges and Metas */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn('badge text-xs font-black border px-3 py-1 rounded-xl', getCategoryBadge(selectedOpportunity.category, language).classes)}>
                  {getCategoryBadge(selectedOpportunity.category, language).label}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[var(--brand-accent)]" />
                  {selectedOpportunity.provider}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400 font-semibold">{language === 'en' ? 'Deadline:' : 'آخر موعد:'}</span>
                <strong className="text-slate-900 dark:text-white font-bold">{formatDate(selectedOpportunity.deadline, language)}</strong>
              </div>
            </div>

            {/* Exclusive Team Member Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 dark:from-amber-400/20 dark:via-amber-400/10 border border-amber-500/40 dark:border-amber-400/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                    {language === 'en' ? 'Exclusive to El-Gogalyia team members only 🔒' : 'مخصص لأعضاء فريق منصة الجوجالية فقط 🔒'}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/90 font-medium">
                    {language === 'en'
                      ? 'This opportunity was curated to support your technical and career journey.'
                      : 'هذه الفرصة تم جلبها ومراجعتها خصيصاً لدعم مسارك المهني والتقني مع الفريق.'}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/25 text-amber-900 dark:text-amber-100">
                {language === 'en' ? 'Priority Admission' : 'أولوية قبول'}
              </span>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">تفاصيل ونبذة عن الفرصة</h4>
              <div className="p-4 bg-slate-50 dark:bg-[#181130] rounded-2xl border border-slate-200/70 dark:border-[#2b224d] text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                {selectedOpportunity.description}
              </div>
            </div>

            {/* Requirements if any */}
            {selectedOpportunity.requirements && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">الشروط والمتطلبات</h4>
                <div className="p-4 bg-slate-50 dark:bg-[#181130] rounded-2xl border border-slate-200/70 dark:border-[#2b224d] text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                  {selectedOpportunity.requirements}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingOpportunity ? 'تعديل بيانات الفرصة / التدريب' : 'نشر فرصة وتدريب جديد للفريق 🎓'}
        description="أدخل تفاصيل الفرصة التدريبية ورابط التقديم ليتمكن أعضاء الفريق من الاطلاع والتقديم المباشر."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              loading={submitting}
              className="btn-primary font-black"
            >
              {editingOpportunity ? 'حفظ التعديلات' : 'نشر الفرصة الآن'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-right font-sans">
          <div>
            <label className="form-label text-xs font-bold">اسم الفرصة أو البرنامج التدريبي *</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="مثال: منحة تدريب وتأهيل مطوري الويب..."
              className="text-xs sm:text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs font-bold">الجهة المقدمة / المؤسسة *</label>
              <Input
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                placeholder="مثال: ITI, DEPI, Google, Orange..."
                className="text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="form-label text-xs font-bold">تصنيف الفرصة *</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as OpportunityCategory)}
                className="form-input text-xs sm:text-sm bg-white dark:bg-[#181130] cursor-pointer"
              >
                <option value="training">برنامج تدريبي وتأهيل</option>
                <option value="job">فرصة عمل وتوظيف</option>
                <option value="scholarship">منحة دراسية</option>
                <option value="workshop">ورشة عمل ومعسكر</option>
                <option value="competition">مسابقة وهاكاثون</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs font-bold">رابط التقديم المباشر (URL) *</label>
              <Input
                type="url"
                value={formApplicationUrl}
                onChange={(e) => setFormApplicationUrl(e.target.value)}
                placeholder="https://example.com/apply"
                className="text-xs sm:text-sm text-left dir-ltr"
                required
              />
            </div>

            <div>
              <label className="form-label text-xs font-bold">آخر موعد للتقديم (Deadline) *</label>
              <Input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="text-xs sm:text-sm cursor-pointer"
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label text-xs font-bold">وصف وتفاصيل الفرصة *</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="اكتب تفاصيل البرنامج والمميزات والمجالات المشمولة..."
              className="form-input min-h-[90px] text-xs sm:text-sm"
              required
            />
          </div>

          <div>
            <label className="form-label text-xs font-bold">الشروط والمتطلبات (اختياري)</label>
            <textarea
              value={formRequirements}
              onChange={(e) => setFormRequirements(e.target.value)}
              placeholder="مثال: • معرفة أساسية بـ JavaScript&#10;• التفرغ الجزئي للمحاضرات..."
              className="form-input min-h-[70px] text-xs sm:text-sm"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="تأكيد حذف الفرصة"
        description={`هل أنت متأكد من حذف فرصة "${deleteTarget?.title}" نهائياً من قائمة الفرص؟`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleting}
      />

      {/* 2-Step Authorization Modal removed — Lead/Co-Lead/Head act directly */}
    </div>
  );
}
