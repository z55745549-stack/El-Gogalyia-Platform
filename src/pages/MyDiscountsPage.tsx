import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Ticket,
  Copy,
  Check,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { subscribeEmployeePurchases } from '@/lib/discounts';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { DiscountPurchase } from '@/types';

export function MyDiscountsPage() {
  const { userProfile } = useAuth();
  const [purchases, setPurchases] = useState<DiscountPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsub = subscribeEmployeePurchases(userProfile.uid, (list) => {
      setPurchases(list);
      setLoading(false);
    });
    return () => unsub();
  }, [userProfile?.uid]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('تم نسخ كود القسيمة إلى الحافظة!');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const filteredPurchases = purchases.filter((p) => {
    let dynamicStatus = p.status;
    if (p.expiresAt && dynamicStatus === 'active') {
      const expTime = (p.expiresAt as any)?.toDate
        ? (p.expiresAt as any).toDate().getTime()
        : new Date(String(p.expiresAt) || 0).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        dynamicStatus = 'expired';
      }
    }
    const matchesStatus = statusFilter === 'all' || dynamicStatus === statusFilter;
    const matchesSearch =
      !search ||
      p.discountTitle.toLowerCase().includes(search.toLowerCase()) ||
      (p.redemptionCode && p.redemptionCode.toLowerCase().includes(search.toLowerCase())) ||
      p.discountValue.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans dir-rtl text-right animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card p-6 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                خصوماتي وقسائمي المشتراة
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سجل كامل لجميع العروض والقسائم التي اشتريتها باستخدام O Coins مع أكواد الاستخدام
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/discounts"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-xs shadow-sm transition-all whitespace-nowrap font-bold"
        >
          <span>تصفح متجر الخصومات</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث باسم الخصم أو كود القسيمة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto pt-0.5">
          {[
            { id: 'all', label: 'الكل', count: purchases.length },
            { id: 'active', label: 'سارية', count: purchases.filter((p) => p.status === 'active').length },
            { id: 'used', label: 'مستخدمة', count: purchases.filter((p) => p.status === 'used').length },
            { id: 'expired', label: 'منتهية', count: purchases.filter((p) => p.status === 'expired').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                statusFilter === tab.id
                  ? 'btn-primary shadow-xs'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border-subtle)]'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Purchased Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 rounded-2xl space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <EmptyState
            icon={<Ticket className="h-10 w-10 text-slate-400" />}
            title="لا توجد مشتريات أو قسائم مسجلة"
            description={
              search
                ? 'لم يتم العثور على أي قسيمة تطابق بحثك.'
                : 'لم تقم بشراء أي عروض خصم حتى الآن. تصفح المتجر واستبدل نقاطك بأفضل المزايا!'
            }
            action={
              !search ? (
                <Link
                  to="/discounts"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-xs font-bold transition-colors shadow-sm"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>تصفح متجر الخصومات الآن</span>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPurchases.map((purchase) => {
            const expTime = purchase.expiresAt
              ? (purchase.expiresAt as any)?.toDate
                ? (purchase.expiresAt as any).toDate().getTime()
                : new Date(String(purchase.expiresAt) || 0).getTime()
              : 0;
            const isExpired =
              purchase.status === 'expired' || (expTime > 0 && expTime < Date.now());

            return (
              <motion.div
                key={purchase.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'card rounded-2xl shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between',
                  isExpired ? 'opacity-70' : 'hover:border-[var(--brand-primary)]/40'
                )}
              >
                {/* Header Strip with Discount Value */}
                <div className="p-4 bg-[var(--surface-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                      {purchase.discountValue}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      🪙 {purchase.ocoinCost} OC
                    </span>
                  </div>

                  <span
                    className={cn(
                      'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border',
                      isExpired
                        ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        : purchase.status === 'used'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    )}
                  >
                    {isExpired ? 'منتهية الصلاحية' : purchase.status === 'used' ? 'تم الاستخدام' : 'سارية وجاهزة'}
                  </span>
                </div>

                {/* Main Content */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {purchase.discountTitle}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>تاريخ الشراء: {new Date(String(purchase.purchasedAt)).toLocaleDateString('ar-EG')}</span>
                      {purchase.expiresAt && (
                        <span>• تنتهي: {new Date(String(purchase.expiresAt)).toLocaleDateString('ar-EG')}</span>
                      )}
                    </div>
                  </div>

                  {/* Voucher Code Box */}
                  {purchase.redemptionCode && (
                    <div className="p-3.5 rounded-xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          كود القسيمة (Voucher Code)
                        </p>
                        <p className="font-mono text-base font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)] tracking-wider select-all">
                          {purchase.redemptionCode}
                        </p>
                      </div>

                      <button
                        onClick={() => handleCopyCode(purchase.redemptionCode!)}
                        className="p-2 rounded-lg bg-white dark:bg-white/5 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] hover:bg-[var(--brand-primary)]/10 transition-colors cursor-pointer"
                        title="نسخ الكود"
                      >
                        {copiedCode === purchase.redemptionCode ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Bottom Actions */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {purchase.id.substring(0, 12)}
                    </span>

                    {purchase.redemptionUrl && (
                      <a
                        href={purchase.redemptionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)] hover:underline"
                      >
                        <span>استخدام العرض</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
