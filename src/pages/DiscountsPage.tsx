import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Tag,
  Search,
  Sparkles,
  ShoppingBag,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Percent,
  Gift,
  Receipt,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { subscribeDiscounts, purchaseDiscount } from '@/lib/discounts';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { Discount, DiscountType } from '@/types';

const DISCOUNT_TYPE_CONFIG: Record<DiscountType, { label: string; icon: any; color: string }> = {
  percentage: { label: 'خصم نسبة %', icon: Percent, color: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' },
  fixed: { label: 'خصم مالي ثابت', icon: Tag, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  voucher: { label: 'قسيمة شراء (Voucher)', icon: Receipt, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  partner: { label: 'عرض شريك معتمد', icon: Sparkles, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  special: { label: 'عرض خاص وحصري', icon: Flame, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

export function DiscountsPage() {
  const { userProfile } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    discount: Discount;
    newBalance: number;
    code: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeDiscounts((list) => {
      setDiscounts(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const currentCoins = Number(userProfile?.oCoinsBalance) || 0;

  const activeDiscounts = discounts.filter((d) => {
    if (d.status !== 'active') return false;
    if (d.expiresAt) {
      const expTime = (d.expiresAt as any)?.toDate
        ? (d.expiresAt as any).toDate().getTime()
        : new Date(String(d.expiresAt) || 0).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) return false;
    }
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.discountValue.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === 'all' || d.discountType === selectedType;
    return matchesSearch && matchesType;
  });

  const handleOpenPurchase = (discount: Discount) => {
    setSelectedDiscount(discount);
    setPurchaseSuccess(null);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedDiscount || !userProfile) return;
    setPurchasing(true);
    try {
      const result = await purchaseDiscount({
        discountId: selectedDiscount.id,
        employee: userProfile,
      });
      toast.success('تمت عملية الشراء بنجاح وخصم النقاط من رصيدك!');
      setPurchaseSuccess({
        discount: selectedDiscount,
        newBalance: result.newBalance,
        code: result.purchase.redemptionCode || '',
      });
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err.message || 'فشلت عملية الشراء. يرجى المحاولة لاحقاً.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans dir-rtl text-right animate-fadeIn">
      {/* Hero & Balance Header */}
      <div className="relative overflow-hidden rounded-3xl card-aurora p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/20">
              <Gift className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
              <span>مكافآت وامتيازات أعضاء منصة الجوجالية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              متجر الخصومات والعروض الحصرية
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              استبدل نقاطك من <span className="text-[var(--brand-accent)] font-bold">O Coins</span> بخصومات وعروض حصرية، قسائم شراء، ومزايا مخصصة لأعضاء المجتمع.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">رصيدك الحالي</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-amber-400">
                    {currentCoins.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-300">O Coins 🪙</span>
                </div>
              </div>
              <Link
                to="/ocoins"
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors whitespace-nowrap"
              >
                سجل النقاط
              </Link>
            </div>

            <Link
              to="/my-discounts"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl btn-accent font-extrabold text-xs sm:text-sm shadow-lg transition-all"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>خصوماتي المشتراة</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث في الخصومات والعروض المتاحة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setSelectedType('all')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                selectedType === 'all'
                  ? 'btn-primary shadow-md shadow-[var(--brand-primary)]/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              )}
            >
              الكل ({discounts.filter((d) => d.status === 'active').length})
            </button>
            {Object.entries(DISCOUNT_TYPE_CONFIG).map(([typeKey, cfg]) => {
              const count = discounts.filter((d) => d.status === 'active' && d.discountType === typeKey).length;
              return (
                <button
                  key={typeKey}
                  onClick={() => setSelectedType(typeKey)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer',
                    selectedType === typeKey
                      ? 'btn-primary shadow-md shadow-[var(--brand-primary)]/20'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  )}
                >
                  <cfg.icon className="h-3.5 w-3.5" />
                  <span>{cfg.label}</span>
                  {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Discounts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 rounded-2xl space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : activeDiscounts.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <EmptyState
            icon={<Tag className="h-10 w-10 text-slate-400" />}
            title="لا توجد خصومات أو عروض متاحة حالياً"
            description={
              search
                ? 'لم يتم العثور على نتائج تطابق معايير البحث المحددة.'
                : 'سيتم إضافة عروض وقسائم خصم جديدة قريباً من قِبل إدارة منصة الجوجالية.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeDiscounts.map((discount) => {
            const typeConfig = DISCOUNT_TYPE_CONFIG[discount.discountType] || DISCOUNT_TYPE_CONFIG.percentage;
            const canAfford = currentCoins >= discount.ocoinCost;
            const expTimestamp = discount.expiresAt
              ? (discount.expiresAt as any)?.toDate
                ? (discount.expiresAt as any).toDate().getTime()
                : new Date(String(discount.expiresAt) || 0).getTime()
              : 0;
            const isExpiringSoon = expTimestamp > 0 && expTimestamp - Date.now() < 3 * 24 * 60 * 60 * 1000;

            return (
              <motion.div
                key={discount.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card rounded-2xl shadow-sm hover:shadow-lg hover:border-[var(--brand-primary)]/40 transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top: Image / Banner */}
                <div className="relative h-44 bg-slate-100 dark:bg-white/5 overflow-hidden">
                  {discount.imageUrl ? (
                    <img
                      src={discount.imageUrl}
                      alt={discount.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--brand-primary)]/15 via-[var(--brand-accent)]/10 to-transparent p-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--brand-primary)]/15 flex items-center justify-center text-[var(--brand-primary)] dark:text-[var(--brand-accent)] mb-2">
                        <Tag className="h-7 w-7" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {typeConfig.label}
                      </span>
                    </div>
                  )}

                  {/* Value Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white shadow-lg border border-white/10">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-black text-[var(--brand-accent)]">{discount.discountValue}</span>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={cn('text-[10px] font-extrabold px-2.5 py-1 rounded-lg border shadow-xs', typeConfig.color)}>
                      {typeConfig.label}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 group-hover:text-[var(--brand-primary)] dark:group-hover:text-[var(--brand-accent)] transition-colors line-clamp-1">
                      {discount.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {discount.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className={cn('h-3.5 w-3.5', isExpiringSoon ? 'text-rose-500 animate-pulse' : 'text-slate-400')} />
                        {discount.expiresAt ? (
                          <span className={cn(isExpiringSoon && 'text-rose-500 font-bold')}>
                            ينتهي: {new Date(String(discount.expiresAt)).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ) : (
                          <span>صلاحية دائمة</span>
                        )}
                      </div>
                      {discount.totalPurchases > 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {discount.totalPurchases} عملية شراء
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm">
                          🪙
                        </div>
                        <div>
                          <div className="text-base font-black text-slate-900 dark:text-slate-100 leading-none">
                            {discount.ocoinCost}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400">O Coins</div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleOpenPurchase(discount)}
                        disabled={!canAfford}
                        className={cn(
                          'gap-1.5 text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer',
                          canAfford
                            ? 'btn-primary shadow-[var(--brand-primary)]/25'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                        )}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>{canAfford ? 'شراء العرض' : 'الرصيد غير كافٍ'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Purchase Confirmation & Success Modal */}
      <Modal
        open={Boolean(selectedDiscount)}
        onClose={() => {
          if (!purchasing) {
            setSelectedDiscount(null);
            setPurchaseSuccess(null);
          }
        }}
        title={purchaseSuccess ? 'تم الشراء بنجاح 🎉' : 'تأكيد شراء الخصم / العرض'}
        size="md"
      >
        {selectedDiscount && (
          <div className="space-y-5 text-right font-sans">
            {purchaseSuccess ? (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    مبارك! تم تفعيل الخصم في محفظتك
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    لقد اشتريت "{purchaseSuccess.discount.title}" بنجاح.
                  </p>
                </div>

                {purchaseSuccess.code && (
                  <div className="p-4 rounded-2xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-bold">كود القسيمة الخاص بك</p>
                    <div className="font-mono text-xl font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)] tracking-widest select-all">
                      {purchaseSuccess.code}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">رصيدك الجديد:</span>
                  <span className="font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                    🪙 {purchaseSuccess.newBalance} O Coins
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Link
                    to="/my-discounts"
                    onClick={() => setSelectedDiscount(null)}
                    className="flex-1 py-3 px-4 rounded-xl btn-primary text-xs font-bold text-center transition-colors shadow-sm"
                  >
                    عرض في قائمة مشترياتي
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDiscount(null)}
                    className="rounded-xl text-xs"
                  >
                    إغلاق
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                        {selectedDiscount.discountValue}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                        {selectedDiscount.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {selectedDiscount.description}
                      </p>
                    </div>
                  </div>

                  {selectedDiscount.terms && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">الشروط والأحكام: </span>
                      {selectedDiscount.terms}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400">
                    <span>سعر الخصم المطلوب:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      🪙 {selectedDiscount.ocoinCost} O Coins
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400">
                    <span>رصيدك الحالي:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      🪙 {currentCoins} O Coins
                    </span>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-bold">
                    <span className="text-slate-900 dark:text-slate-100">الرصيد بعد إتمام الشراء:</span>
                    <span
                      className={cn(
                        'font-black',
                        currentCoins - selectedDiscount.ocoinCost < 0
                          ? 'text-rose-500'
                          : 'text-emerald-400'
                      )}
                    >
                      🪙 {Math.max(0, currentCoins - selectedDiscount.ocoinCost)} O Coins
                    </span>
                  </div>
                </div>

                {currentCoins < selectedDiscount.ocoinCost && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>رصيدك غير كافٍ لإتمام عملية الشراء. أنت بحاجة إلى {selectedDiscount.ocoinCost - currentCoins} O Coins إضافية.</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDiscount(null)}
                    disabled={purchasing}
                    className="rounded-xl text-xs"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleConfirmPurchase}
                    loading={purchasing}
                    disabled={currentCoins < selectedDiscount.ocoinCost || purchasing}
                    className="gap-2 rounded-xl text-xs font-bold btn-primary"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>تأكيد الشراء والخصم</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
