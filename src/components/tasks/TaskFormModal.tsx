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

      setEmployees(allUsers);
    };

    loadEmployees();
  }, [open]);

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
    if (!data.deadline) { toast.error('الموعد النهائي مطلوب.'); return; }
    if (selectedUids.length === 0) { toast.error('يجب تحديد موظف واحد على الأقل للتكليف.'); return; }

    setSubmitting(true);
    try {
      // Build assignedNames from selected UIDs (stable identifier)
      const selectedEmployees = employees.filter((e) => selectedUids.includes(e.uid));
      const assignedNames = selectedEmployees.map((e) => e.displayName || e.username || '');

      const taskId = await createTask(
        {
          title: data.title,
          description: data.description,
          requirements: data.requirements || '',
          priority: data.priority,
          deadline: new Date(data.deadline),
          oCoinsReward: Number(data.oCoinsReward) || 0,
          assignedTo: selectedUids, // use stable UID as identifier (spec requirement)
        },
        {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
          committeeId: userProfile.committeeId || null,
          committeeName: userProfile.committeeName || null,
        },
        assignedNames
      );

      await logActivity({
        actor: userProfile.username,
        actorName: userProfile.displayName,
        actorPhoto: userProfile.photoURL || '',
        action: 'task.created',
        targetType: 'task',
        targetId: taskId,
        targetName: data.title,
        metadata: { assignedTo: selectedUids, reward: Number(data.oCoinsReward) || 0 },
      });

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
          <Input
            label="الموعد النهائي *"
            type="date"
            min={new Date().toISOString().split('T')[0]}
            {...register('deadline', { required: 'الموعد النهائي مطلوب' })}
          />
          <Input
            label="مكافأة O Coins *"
            type="number"
            min="0"
            {...register('oCoinsReward', { valueAsNumber: true })}
          />
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
