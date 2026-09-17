import { useState, useEffect } from 'react';
import { collection, getDocs, db } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Search, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createTask, logActivity } from '@/lib/database-service';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/utils';
import type { UserProfile, TaskPriority } from '@/types';

interface TaskFormData {
  title: string;
  description: string;
  requirements: string;
  priority: TaskPriority;
  deadline: string;
  oCoinsReward: number;
}

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function TaskFormModal({ open, onClose }: TaskFormModalProps) {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Time & AM/PM Deadline controls
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [deadlineHour, setDeadlineHour] = useState('11');
  const [deadlineMinute, setDeadlineMinute] = useState('59');
  const [deadlinePeriod, setDeadlinePeriod] = useState<'AM' | 'PM'>('PM');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      priority: 'medium',
      deadline: '',
      oCoinsReward: 50,
    },
  });

  useEffect(() => {
    if (!open) return;

    const loadEmployees = async () => {
      const allUsers: UserProfile[] = [];

      // Load from Supabase
      try {
        const snap = await getDocs(collection(db, 'users'));
        snap.docs.forEach((d) => {
          const data = { uid: d.id, ...d.data() } as UserProfile;
          if (data.username && data.status === 'active') allUsers.push(data);
        });
      } catch (e) {
        console.warn('Supabase users load notice:', e);
      }

      // Merge with local storage (deduplicate by uid)
      const localList: UserProfile[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const uidSet = new Set(allUsers.map((u) => u.uid));
      localList.forEach((u) => {
        if (u.username && u.status === 'active' && !uidSet.has(u.uid)) {
          allUsers.push(u);
        }
      });

      // Strict Assignment Hierarchy:
      // 1. Lead & Co-Lead are executive administrators only — NEVER assigned tasks by anyone!
      // 2. Head & Vice-Head can ONLY assign to members/vice-heads of their own committee.
      // 3. Exclude self.
      const isTopLeader = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';
      const myCommId = userProfile?.committeeId;
      const myCommName = (userProfile?.committeeName || '').trim().toLowerCase();

      const assignableUsers = allUsers.filter((u) => {
        if (u.uid === userProfile?.uid) return false;
        // Strictly exclude Lead and Co-Lead
        if (u.role === 'lead' || u.role === 'co_lead') return false;
        // If creator is Head or Vice-Head, strictly restrict to their committee
        if (!isTopLeader) {
          const uCommId = u.committeeId;
          const uCommName = (u.committeeName || '').trim().toLowerCase();
          const matchId = Boolean(myCommId && uCommId === myCommId);
          const matchName = Boolean(myCommName && uCommName === myCommName);
          return matchId || matchName;
        }
        return true;
      });

      assignableUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ar', { sensitivity: 'base' }));
      setEmployees(assignableUsers);
    };

    loadEmployees();
  }, [open, userProfile]);

  const filteredEmployees = employees.filter((e) =>
    (e.displayName || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.username || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const toggleEmployee = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const onSubmit = async (data: TaskFormData) => {
    if (!userProfile) return;
    if (!data.title.trim()) { toast.error('عنوان المهمة مطلوب.'); return; }
    if (!data.description.trim()) { toast.error('وصف المهمة مطلوب.'); return; }
    if (!deadlineDate) { toast.error('الموعد النهائي مطلوب.'); return; }
    if (selectedUids.length === 0) { toast.error('يجب تحديد موظف واحد على الأقل للتكليف.'); return; }

    let hour24 = parseInt(deadlineHour, 10);
    if (deadlinePeriod === 'PM' && hour24 < 12) hour24 += 12;
    if (deadlinePeriod === 'AM' && hour24 === 12) hour24 = 0;
    const [y, m, d] = deadlineDate.split('-').map(Number);
    const finalDeadline = new Date(y, m - 1, d, hour24, parseInt(deadlineMinute, 10), 0);

    setSubmitting(true);
    try {
      // Build assignedNames from selected UIDs (stable identifier)
      const selectedEmployees = employees.filter((e) => selectedUids.includes(e.uid));
      const assignedNames = selectedEmployees.map((e) => e.displayName || e.username || '');

      await createTask(
        {
          title: data.title,
          description: data.description,
          requirements: data.requirements || '',
          priority: data.priority,
          deadline: finalDeadline,
          oCoinsReward: Number(data.oCoinsReward) || 0,
          assignedTo: selectedUids, // use stable UID as identifier (spec requirement)
        },
        {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
          committeeId: userProfile.committeeId || null,
          committeeName: userProfile.committeeName || null,
          photoURL: userProfile.photoURL,
        },
        assignedNames
      );

      toast.success('تم إنشاء المهمة وإسنادها بنجاح!');
      reset();
      setSelectedUids([]);
      setEmployeeSearch('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('فشل إنشاء المهمة. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setSelectedUids([]);
    setEmployeeSearch('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="إنشاء مهمة جديدة"
      description="حدد تفاصيل المهمة وكلّف الموظفين المناسبين"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>إلغاء</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={submitting}>إنشاء وتكليف المهمة</Button>
        </>
      }
    >
      <div className="space-y-4 font-sans text-right dir-rtl">
        {/* Title */}
        <Input
          label="عنوان المهمة *"
          placeholder="مثال: إعداد حملة تسويقية على الإنستجرام"
          error={errors.title?.message}
          {...register('title', { required: 'العنوان مطلوب' })}
        />

        {/* Description */}
        <div>
          <label className="form-label">وصف المهمة *</label>
          <textarea
            className={cn('form-input min-h-[90px]', errors.description && 'border-red-400')}
            placeholder="اشرح تفاصيل المهمة والنتائج المطلوبة..."
            {...register('description', { required: 'الوصف مطلوب' })}
          />
          {errors.description && <p className="form-error">{errors.description.message}</p>}
        </div>

        {/* Requirements */}
        <div>
          <label className="form-label">المتطلبات (اختياري)</label>
          <textarea
            className="form-input min-h-[70px]"
            placeholder="- 3 تصاميم عالية الدقة&#10;- بناءً على هوية العلامة التجارية"
            {...register('requirements')}
          />
        </div>

        {/* Priority + Deadline + O Coins */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="الأولوية *"
            options={[
              { value: 'urgent', label: '🔴 عاجل (Urgent)' },
              { value: 'high', label: '🟠 عالي (High)' },
              { value: 'medium', label: '🟡 متوسط (Medium)' },
              { value: 'low', label: '🟢 منخفض (Low)' },
            ]}
            {...register('priority')}
          />

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
              مكافأة O-Coins التقديرية *
            </label>
            <Input
              type="number"
              min="0"
              {...register('oCoinsReward', { valueAsNumber: true })}
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              ملاحظة: يمكنك تأكيد أو تعديل مكافأة كل عضو عند اعتماد تسليمه.
            </p>
          </div>
        </div>

        {/* Deadline with Exact Time & AM/PM Selector */}
        <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-slate-50/50 dark:bg-white/[0.02] space-y-2.5">
          <label className="block text-xs font-bold text-[var(--text-secondary)]">
            الموعد النهائي والتوقيت الدقيق للتسليم *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">اليوم والتاريخ:</label>
              <Input
                type="date"
                value={deadlineDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDeadlineDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">الساعة:</label>
              <select
                value={deadlineHour}
                onChange={(e) => setDeadlineHour(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-xs font-bold text-[var(--text-primary)] outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                  <option key={h} value={h}>
                    {h.padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">الفترة (AM/PM):</label>
              <div className="flex rounded-lg overflow-hidden border border-[var(--border-default)] h-10">
                <button
                  type="button"
                  onClick={() => setDeadlinePeriod('PM')}
                  className={`flex-1 text-xs font-black transition-colors ${
                    deadlinePeriod === 'PM'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  مساءً (PM)
                </button>
                <button
                  type="button"
                  onClick={() => setDeadlinePeriod('AM')}
                  className={`flex-1 text-xs font-black transition-colors ${
                    deadlinePeriod === 'AM'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  صباحاً (AM)
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            ⏰ التسليم ينتهي في: {deadlineDate || '—'} الساعة {deadlineHour}:{deadlineMinute} {deadlinePeriod === 'PM' ? 'مساءً' : 'صباحاً'}
          </p>
        </div>

        {/* Assign To (Multi-Select by UID) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label mb-0">تكليف الموظفين * (متعدد)</label>
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>
              {selectedUids.length} مختار
            </span>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
            }}
          >
            {/* Search bar */}
            <div
              className="p-2.5"
              style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
            >
              <Input
                placeholder="بحث بالاسم أو اسم المستخدم..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>

            {/* Employee list */}
            <div className="max-h-48 overflow-y-auto no-scrollbar divide-y divide-[var(--border-subtle)]">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                  لا يوجد موظفون متاحون
                </p>
              ) : (
                filteredEmployees.map((emp) => {
                  const uname = emp.username || '';
                  const isSelected = selectedUids.includes(emp.uid);
                  return (
                    <button
                      key={emp.uid}
                      type="button"
                      onClick={() => toggleEmployee(emp.uid)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-right cursor-pointer"
                      style={{
                        background: isSelected ? 'rgba(108,99,255,0.08)' : 'transparent',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(108,99,255,0.08)' : 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: isSelected ? 'var(--brand-primary)' : 'transparent',
                          border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-strong)',
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                      </div>
                      <Avatar src={emp.photoURL} name={emp.displayName || uname} size="xs" />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {emp.displayName}
                        </p>
                        <p className="text-[11px] truncate font-mono" style={{ color: 'var(--text-muted)' }}>
                          @{uname}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {emp.role}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
