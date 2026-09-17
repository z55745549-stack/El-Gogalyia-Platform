import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Plus,
  Coins,
  Edit3,
  Trash2,
  Power,
  Search,
  Users,
  ShoppingBag,
  ExternalLink,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Percent,
  Flame,
  FileText,
  Lock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeDiscounts,
  subscribeAllPurchases,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleDiscountStatus
} from '@/lib/discounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { Discount, DiscountPurchase, DiscountType, DiscountStatus } from '@/types';

const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: 'percentage', label: 'خصم نسبة مئوية (%)' },
  { value: 'fixed', label: 'خصم بمبلغ ثابت (Fixed Amount)' },
  { value: 'voucher', label: 'قسيمة شراء / كود (Voucher / Coupon)' },
  { value: 'partner', label: 'عرض من شريك معتمد (Partner Offer)' },
  { value: 'special', label: 'عرض خاص ومحدود (Special Offer)' },
];

export function AdminDiscountsPage() {
  const { userProfile } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [allPurchases, setAllPurchases] = useState<DiscountPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<DiscountType>('percentage');
  const [formValue, setFormValue] = useState('15%');
  const [formCost, setFormCost] = useState<number>(10);
  const [formPromoCode, setFormPromoCode] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formRedemptionUrl, setFormRedemptionUrl] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStatus, setFormStatus] = useState<DiscountStatus>('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubDiscounts = subscribeDiscounts((list) => {
      setDiscounts(list);
      setLoading(false);
    });
    const unsubPurchases = subscribeAllPurchases((list) => {
      setAllPurchases(list);
    });
    return () => {
      unsubDiscounts();
      unsubPurchases();
    };
  }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormType('percentage');
    setFormValue('');
    setFormCost(10);
    setFormPromoCode('');
    setFormExpiresAt('');
    setFormRedemptionUrl('');
    setFormTerms('');
    setFormImageUrl('');
    setFormStatus('active');
    setSelectedDiscount(null);
  };

  const handleOpenEdit = (discount: Discount) => {
    setSelectedDiscount(discount);
    setFormTitle(discount.title);
    setFormDesc(discount.description);
    setFormType(discount.discountType);
    setFormValue(discount.discountValue);
    setFormCost(discount.ocoinCost);
    setFormPromoCode(discount.promoCode || '');
    setFormExpiresAt(discount.expiresAt ? String(discount.expiresAt).substring(0, 16) : '');
    setFormRedemptionUrl(discount.redemptionUrl || '');
    setFormTerms(discount.terms || '');
    setFormImageUrl(discount.imageUrl || '');
    setFormStatus(discount.status);
    setShowEditModal(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !formTitle.trim() || !formValue.trim()) {
      toast.error('يرجى ملء الحقول الإلزامية');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedDiscount) {
        // Update
        await updateDiscount(
          selectedDiscount.id,
          {
            title: formTitle.trim(),
            description: formDesc.trim(),
            discountType: formType,
            discountValue: formValue.trim(),
            ocoinCost: formCost,
            promoCode: formPromoCode.trim(),
            expiresAt: formExpiresAt,
            redemptionUrl: formRedemptionUrl.trim(),
            terms: formTerms.trim(),
            imageUrl: formImageUrl.trim(),
            status: formStatus,
          },
          userProfile
        );
        toast.success('تم تحديث العرض بنجاح');
        setShowEditModal(false);
      } else {
        // Create
        await createDiscount({
          title: formTitle.trim(),
          description: formDesc.trim(),
          discountType: formType,
          discountValue: formValue.trim(),
          ocoinCost: formCost,
          promoCode: formPromoCode.trim(),
          expiresAt: formExpiresAt,
          redemptionUrl: formRedemptionUrl.trim(),
          terms: formTerms.trim(),
          imageUrl: formImageUrl.trim(),
          status: formStatus,
          creator: userProfile,
        });
        toast.success('تم إنشاء الخصم / العرض الجديد بنجاح');
        setShowAddModal(false);
      }
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (discount: Discount) => {
    if (!userProfile) return;
    const newStatus: DiscountStatus = discount.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleDiscountStatus(discount.id, newStatus, userProfile, discount.title);
      toast.success(newStatus === 'active' ? 'تم تفعيل العرض' : 'تم تعطيل العرض');
    } catch (err) {
      toast.error('فشل تغيير الحالة');
    }
  };

  const handleDelete = async () => {
    if (!selectedDiscount || !userProfile) return;
    setSubmitting(true);
    try {
      await deleteDiscount(selectedDiscount.id, userProfile, selectedDiscount.title);
      toast.success('تم حذف العرض بنجاح');
      setShowDeleteModal(false);
      setSelectedDiscount(null);
    } catch (err) {
      toast.error('فشل حذف العرض');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalDiscounts = discounts.length;
  const activeDiscounts = discounts.filter((d) => d.status === 'active').length;
  const totalPurchasesCount = allPurchases.length;
  const totalCoinsCollected = discounts.reduce((acc, d) => acc + (d.totalCoinsCollected || 0), 0);

  const filteredDiscounts = discounts.filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.discountValue.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedDiscountPurchases = selectedDiscount
    ? allPurchases.filter((p) => p.discountId === selectedDiscount.id)
    : [];

  return (
    <div className="space-y-6 font-sans dir-rtl text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card p-6 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Tag className="h-6 w-6 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
            <span>إدارة الخصومات والمشتريات (Discounts Management)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إضافة وإدارة عروض الخصم المتاحة للموظفين، متابعة عمليات الشراء، وتحصيل نقاط O Coins
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="gap-2 btn-primary font-bold text-xs py-2.5 px-4 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة خصم / عرض جديد</span>
        </Button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي العروض', val: totalDiscounts, icon: Tag, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
          { label: 'العروض النشطة', val: activeDiscounts, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'إجمالي المشتريات', val: totalPurchasesCount, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'O Coins المحصلة', val: `${totalCoinsCollected} 🪙`, icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
        ].map((m, i) => (
          <div
            key={i}
            className="card p-4 rounded-2xl shadow-xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{m.label}</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{m.val}</p>
            </div>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', m.bg, m.color)}>
              <m.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="البحث في العروض..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'active', 'inactive'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                statusFilter === s
                  ? 'btn-primary shadow-xs'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border-subtle)]'
              )}
            >
              {s === 'all' ? 'الكل' : s === 'active' ? 'نشطة فقط' : 'معطلة'}
            </button>
          ))}
        </div>
      </div>

      {/* Discounts Table (Desktop) */}
      <div className="card rounded-2xl shadow-xs overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border-subtle)] text-[var(--muted-foreground)] font-bold">
              <tr>
                <th className="p-4">العرض / الخصم</th>
                <th className="p-4">النوع</th>
                <th className="p-4">القيمة</th>
                <th className="p-4">السعر (O Coins)</th>
                <th className="p-4">تاريخ الانتهاء</th>
                <th className="p-4">المشتريات</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
              {filteredDiscounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {discount.imageUrl ? (
                        <img src={discount.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] flex items-center justify-center font-bold">
                          <Tag className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-slate-100">{discount.title}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{discount.description}</p>
                        {discount.promoCode && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                            <Lock className="h-3 w-3" />
                            <span>كود سري: {discount.promoCode}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                      {DISCOUNT_TYPES.find((t) => t.value === discount.discountType)?.label || discount.discountType}
                    </span>
                  </td>

                  <td className="p-4 font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                    {discount.discountValue}
                  </td>

                  <td className="p-4 font-black text-slate-800 dark:text-slate-200">
                    🪙 {discount.ocoinCost}
                  </td>

                  <td className="p-4 text-slate-500">
                    {discount.expiresAt ? new Date(String(discount.expiresAt)).toLocaleDateString('ar-EG') : 'دائم'}
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => {
                        setSelectedDiscount(discount);
                        setShowPurchasesModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors font-bold cursor-pointer"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>{discount.totalPurchases || 0} عملية</span>
                    </button>
                  </td>

                  <td className="p-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                        discount.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', discount.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500')} />
                      {discount.status === 'active' ? 'نشط' : 'معطل'}
                    </span>
                  </td>

                  <td className="p-4 text-left">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleStatus(discount)}
                        title={discount.status === 'active' ? 'تعطيل' : 'تفعيل'}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <Power className={cn('h-4 w-4', discount.status === 'active' ? 'text-emerald-600' : 'text-slate-400')} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(discount)}
                        title="تعديل"
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDiscount(discount);
                          setShowDeleteModal(true);
                        }}
                        title="حذف"
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredDiscounts.map((discount) => (
          <div
            key={`m-${discount.id}`}
            className="card p-4 rounded-2xl space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                  {discount.discountValue}
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {discount.title}
                </h3>
              </div>
              <span className="text-xs font-black text-amber-600">🪙 {discount.ocoinCost} OC</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{discount.description}</p>

            {discount.promoCode && (
              <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <Lock className="h-3 w-3" />
                <span>كود سري: {discount.promoCode}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setSelectedDiscount(discount);
                  setShowPurchasesModal(true);
                }}
                className="text-xs text-blue-600 font-bold"
              >
                {discount.totalPurchases || 0} عملية شراء
              </button>

              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleStatus(discount)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600"
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleOpenEdit(discount)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedDiscount(discount);
                    setShowDeleteModal(true);
                  }}
                  className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Discount Modal */}
      <Modal
        open={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetForm();
        }}
        title={showEditModal ? 'تعديل عرض الخصم' : 'إضافة عرض / خصم جديد'}
        size="lg"
      >
        <form onSubmit={handleSaveDiscount} className="space-y-4 text-right font-sans">
          <Input
            label="عنوان الخصم / العرض *"
            placeholder="مثال: خصم 15% على مشتريات نون"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <Textarea
            label="وصف العرض وتفاصيله *"
            placeholder="اكتب شرحاً تفصيلياً عما يحصل عليه الموظف..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="نوع الخصم"
              value={formType}
              onChange={(e) => setFormType(e.target.value as DiscountType)}
              options={DISCOUNT_TYPES}
            />

            <Input
              label="قيمة الخصم الظاهرة *"
              placeholder="مثال: 15% أو 50 جنيه أو شحن مجاني"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              label="سعر الشراء بـ O Coins *"
              placeholder="10"
              value={formCost}
              onChange={(e) => setFormCost(Number(e.target.value))}
              required
            />

            <Input
              type="datetime-local"
              label="تاريخ ووقت انتهاء الصلاحية (اختياري)"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Input
              label="كود الخصم / القسيمة السري (Promo Code / Voucher Code - اختياري)"
              placeholder="مثال: NOON15 أو SAVE50 أو EGY2026"
              value={formPromoCode}
              onChange={(e) => setFormPromoCode(e.target.value)}
            />
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>هذا الكود سري ومخفي تماماً عن الموظفين أثناء التصفح، ولن يظهر للموظف إلا بعد إتمام عملية الشراء واستبدال نقاط O Coins بنجاح.</span>
            </p>
          </div>

          <Input
            label="رابط الاستخدام الخارجي (Redemption URL - اختياري)"
            placeholder="https://example.com/redeem"
            value={formRedemptionUrl}
            onChange={(e) => setFormRedemptionUrl(e.target.value)}
          />

          <Input
            label="رابط صورة الغلاف (Image URL - اختياري)"
            placeholder="https://images.unsplash.com/..."
            value={formImageUrl}
            onChange={(e) => setFormImageUrl(e.target.value)}
          />

          <Textarea
            label="الشروط والأحكام الخاصة بالعرض (اختياري)"
            placeholder="مثال: يسري العرض للمشتريات التي تتجاوز 200 جنيه..."
            value={formTerms}
            onChange={(e) => setFormTerms(e.target.value)}
          />

          <Select
            label="حالة العرض"
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as DiscountStatus)}
            options={[
              { value: 'active', label: 'نشط ومتاح للشراء (Active)' },
              { value: 'inactive', label: 'معطل مؤقتاً (Inactive)' },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                resetForm();
              }}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="btn-primary font-bold"
            >
              {showEditModal ? 'حفظ التعديلات' : 'نشر العرض'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Discount Purchases Log Modal */}
      <Modal
        open={showPurchasesModal}
        onClose={() => {
          setShowPurchasesModal(false);
          setSelectedDiscount(null);
        }}
        title={`سجل مشتريات: ${selectedDiscount?.title || ''}`}
        size="lg"
      >
        <div className="space-y-4 text-right font-sans">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--brand-primary)]/5 dark:bg-white/5 border border-[var(--brand-primary)]/20 text-xs">
            <span>إجمالي المشتريات: <strong>{selectedDiscountPurchases.length}</strong></span>
            <span>إجمالي النقاط المحصلة: <strong>{selectedDiscount?.totalCoinsCollected || 0} O Coins 🪙</strong></span>
          </div>

          {selectedDiscountPurchases.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              لم يقم أي موظف بشراء هذا الخصم حتى الآن.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {selectedDiscountPurchases.map((purchase) => (
                <div key={purchase.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={purchase.employeeName} src={purchase.employeePhoto} size="sm" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{purchase.employeeName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        كود: {purchase.redemptionCode || 'N/A'} • {new Date(String(purchase.purchasedAt)).toLocaleString('ar-EG')}
                      </p>
                    </div>
                  </div>

                  <span className="font-black text-amber-600">
                    🪙 {purchase.ocoinCost} OC
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="حذف عرض الخصم"
        description={`هل أنت متأكد من رغبتك في حذف "${selectedDiscount?.title}"؟ لن يتمكن الموظفون من شرائه مجدداً.`}
        confirmLabel="حذف نهائي"
        cancelLabel="إلغاء"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}
