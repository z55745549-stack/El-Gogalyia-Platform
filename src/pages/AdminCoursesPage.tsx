import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  Edit3,
  Trash2,
  Power,
  Search,
  ExternalLink,
  Sparkles,
  BookOpen,
  Clock,
  FolderPlus,
  FolderTree,
  RefreshCw,
  Eye,
  ListVideo,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Film
} from 'lucide-react';

function YoutubeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
import { useAuth } from '@/context/AuthContext';
import {
  subscribeCourses,
  subscribeCourseCategories,
  createCourse,
  updateCourse,
  deleteCourse,
  toggleCourseStatus,
  createCourseCategory,
  updateCourseCategory,
  deleteCourseCategory,
  resolveCourseCoverImage,
  syncCoursePlaylist,
  subscribeCourseLessons,
  deleteCourseLesson,
  getCourseYoutubeUrl,
  getCourseDirectYoutubeWatchLink,
} from '@/lib/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { Course, CourseCategory, CourseStatus, CourseLevel, CourseLesson } from '@/types';

export function AdminCoursesPage() {
  const { userProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'courses' | 'categories'>('courses');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Course Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);

  // Category Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<CourseCategory | null>(null);
  const [showDeleteCatModal, setShowDeleteCatModal] = useState(false);
  const [targetCat, setTargetCat] = useState<CourseCategory | null>(null);

  // Course Form States
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formLevel, setFormLevel] = useState<CourseLevel>('all');
  const [formDuration, setFormDuration] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formStatus, setFormStatus] = useState<CourseStatus>('published');

  // Category Form States
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#7C00FE');

  // Lessons Modal & Sync States
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [showLessonsModal, setShowLessonsModal] = useState(false);
  const [selectedCourseForLessons, setSelectedCourseForLessons] = useState<Course | null>(null);
  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubCourses = subscribeCourses((list) => {
      setCourses(list);
      setLoading(false);
    }, false);

    const unsubCategories = subscribeCourseCategories((list) => {
      setCategories(list);
    });

    return () => {
      unsubCourses();
      unsubCategories();
    };
  }, []);

  // Subscribe to lessons when lessons modal is opened for a course
  useEffect(() => {
    if (!selectedCourseForLessons || !showLessonsModal) return;

    const unsub = subscribeCourseLessons(selectedCourseForLessons.id, (list) => {
      setCourseLessons(list);
    });

    return () => unsub();
  }, [selectedCourseForLessons?.id, showLessonsModal]);

  const resetCourseForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormCategoryName(categories[0]?.name || 'تكنولوجيا وبرمجة');
    setFormYoutubeUrl('');
    setFormExternalUrl('');
    setFormThumbnailUrl('');
    setFormLevel('all');
    setFormDuration('');
    setFormInstructor('');
    setFormStatus('published');
    setEditingCourse(null);
  };

  const resetCatForm = () => {
    setCatName('');
    setCatDesc('');
    setCatColor('#7C00FE');
    setEditingCat(null);
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourse(course);
    setFormTitle(course.title);
    setFormDesc(course.description);
    setFormCategoryName(course.categoryName);
    setFormYoutubeUrl(getCourseYoutubeUrl(course));
    setFormExternalUrl(course.externalUrl || '');
    setFormThumbnailUrl(course.thumbnailUrl || '');
    setFormLevel(course.level || 'all');
    setFormDuration(course.duration || '');
    setFormInstructor(course.instructor || '');
    setFormStatus(course.status);
    setShowCourseModal(true);
  };

  const handleOpenEditCat = (cat: CourseCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatColor(cat.color || '#7C00FE');
    setShowCatModal(true);
  };

  const handleSyncPlaylist = async (course: Course) => {
    if (!userProfile) return;
    const ytUrl = getCourseYoutubeUrl(course);
    if (!ytUrl) {
      toast.error('هذه الدورة لا تحتوي على رابط YouTube. يرجى تعديل الدورة وإضافة الرابط أولاً.');
      return;
    }

    setSyncingCourseId(course.id);
    try {
      const res = await syncCoursePlaylist(course.id, ytUrl, userProfile);
      toast.success(`تمت مزامنة المحتوى بنجاح! تم استيراد وتحديث ${res.totalCount} درس 🎬`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'فشلت مزامنة المحتوى من يوتيوب.');
    } finally {
      setSyncingCourseId(null);
    }
  };

  const handleOpenLessonsModal = (course: Course) => {
    setSelectedCourseForLessons(course);
    setShowLessonsModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !formTitle.trim() || !formCategoryName.trim()) {
      toast.error('يرجى ملء الحقول الإلزامية');
      return;
    }

    setSubmitting(true);
    try {
      let savedCourseId = '';
      if (editingCourse) {
        savedCourseId = editingCourse.id;
        await updateCourse(
          editingCourse.id,
          {
            title: formTitle.trim(),
            description: formDesc.trim(),
            categoryName: formCategoryName.trim(),
            youtubePlaylistUrl: formYoutubeUrl.trim(),
            externalUrl: formExternalUrl.trim(),
            thumbnailUrl: formThumbnailUrl.trim(),
            level: formLevel,
            duration: formDuration.trim(),
            instructor: formInstructor.trim(),
            status: formStatus,
          },
          userProfile
        );
        toast.success('تم تحديث بيانات الدورة بنجاح');
      } else {
        savedCourseId = await createCourse({
          title: formTitle.trim(),
          description: formDesc.trim(),
          categoryName: formCategoryName.trim(),
          youtubePlaylistUrl: formYoutubeUrl.trim(),
          externalUrl: formExternalUrl.trim(),
          thumbnailUrl: formThumbnailUrl.trim(),
          level: formLevel,
          duration: formDuration.trim(),
          instructor: formInstructor.trim(),
          status: formStatus,
          creator: userProfile,
        });
        toast.success('تم إنشاء الدورة بنجاح');
      }

      // Auto-sync playlist if YouTube URL provided
      if (formYoutubeUrl.trim().length > 0 && savedCourseId) {
        try {
          await syncCoursePlaylist(savedCourseId, formYoutubeUrl.trim(), userProfile);
        } catch (syncErr) {
          console.warn('Auto-sync notice:', syncErr);
        }
      }

      setShowCourseModal(false);
      resetCourseForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء حفظ الدورة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !catName.trim()) {
      toast.error('يرجى إدخال اسم التصنيف');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCat) {
        await updateCourseCategory(
          editingCat.id,
          {
            name: catName.trim(),
            description: catDesc.trim(),
            color: catColor,
          },
          userProfile
        );
        toast.success('تم تحديث التصنيف بنجاح');
      } else {
        await createCourseCategory({
          name: catName.trim(),
          description: catDesc.trim(),
          color: catColor,
          creator: userProfile,
        });
        toast.success('تمت إضافة التصنيف الجديد بنجاح');
      }
      setShowCatModal(false);
      resetCatForm();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ التصنيف');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!targetCourse || !userProfile) return;
    setSubmitting(true);
    try {
      await deleteCourse(targetCourse.id, userProfile, targetCourse.title);
      toast.success('تم حذف الدورة بنجاح');
      setShowDeleteCourseModal(false);
      setTargetCourse(null);
    } catch (err) {
      toast.error('فشل حذف الدورة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCat = async () => {
    if (!targetCat || !userProfile) return;
    setSubmitting(true);
    try {
      await deleteCourseCategory(targetCat.id, userProfile, targetCat.name);
      toast.success('تم حذف التصنيف بنجاح');
      setShowDeleteCatModal(false);
      setTargetCat(null);
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف التصنيف');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCourseStatus = async (course: Course) => {
    if (!userProfile) return;
    const newStatus: CourseStatus = course.status === 'published' ? 'unpublished' : 'published';
    try {
      await toggleCourseStatus(course.id, newStatus, userProfile, course.title);
      toast.success(newStatus === 'published' ? 'تم نشر الدورة' : 'تم إلغاء نشر الدورة');
    } catch (err) {
      toast.error('فشل تغيير حالة الدورة');
    }
  };

  // Metrics
  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => c.status === 'published').length;
  const draftCourses = courses.filter((c) => c.status === 'draft' || c.status === 'unpublished').length;
  const totalCats = categories.length;

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.categoryName.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructor && c.instructor.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || c.categoryName === categoryFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans dir-rtl text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-white/[0.03] p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <GraduationCap className="h-6 w-6 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
            <span>إدارة الدورات والتصنيفات (Courses & Categories)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إضافة وإدارة المسارات التعليمية المجانية، ربط قوائم تشغيل YouTube، وإدارة التصنيفات الديناميكية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'courses' ? (
            <Button
              onClick={() => {
                resetCourseForm();
                setShowCourseModal(true);
              }}
              className="gap-2 btn-primary font-bold text-xs py-2.5 px-4 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة دورة جديدة</span>
            </Button>
          ) : (
            <Button
              onClick={() => {
                resetCatForm();
                setShowCatModal(true);
              }}
              className="gap-2 btn-primary font-bold text-xs py-2.5 px-4 cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              <span>إضافة تصنيف جديد</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الدورات', val: totalCourses, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
          { label: 'الدورات المنشورة', val: publishedCourses, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'المسودات والمؤجلة', val: draftCourses, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'التصنيفات المتاحة', val: totalCats, icon: FolderTree, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
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

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('courses')}
          className={cn(
            'px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'courses'
              ? 'btn-primary shadow-md'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
          )}
        >
          <BookOpen className="h-4 w-4" />
          <span>الدورات التعليمية ({totalCourses})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            'px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'categories'
              ? 'btn-primary shadow-md'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
          )}
        >
          <FolderTree className="h-4 w-4" />
          <span>إدارة التصنيفات ({totalCats})</span>
        </button>
      </div>

      {activeTab === 'courses' ? (
        /* TAB 1: COURSES MANAGEMENT */
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-white/[0.03] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="البحث باسم الدورة أو المدرب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)] cursor-pointer"
              >
                <option value="all">جميع التصنيفات</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)] cursor-pointer"
              >
                <option value="all">جميع الحالات</option>
                <option value="published">منشورة (Published)</option>
                <option value="draft">مسودة (Draft)</option>
                <option value="unpublished">غير منشورة</option>
              </select>
            </div>
          </div>

          {/* Courses Table (Desktop) */}
          <div className="card rounded-2xl shadow-xs overflow-hidden hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border-subtle)] text-[var(--muted-foreground)] font-bold">
                  <tr>
                    <th className="p-4">الدورة التعليمية</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">الدروس وقائمة YouTube</th>
                    <th className="p-4">المستوى</th>
                    <th className="p-4">المدرب</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
                  {filteredCourses.map((course) => {
                    const isSyncing = syncingCourseId === course.id;
                    const ytUrl = getCourseYoutubeUrl(course);
                    const hasYoutube = Boolean(ytUrl);

                    return (
                      <tr key={course.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1A1A24] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={course.thumbnailUrl}
                              alt=""
                              className="w-12 h-10 rounded-lg object-cover shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
                              }}
                            />
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1">{course.title}</p>
                              <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{course.description}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/50">
                            {course.categoryName}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleOpenLessonsModal(course)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] font-bold hover:bg-[var(--brand-primary)]/20 transition-colors w-fit cursor-pointer"
                            >
                              <ListVideo className="h-3.5 w-3.5" />
                              <span>{course.totalLessons ? `${course.totalLessons} درس` : 'إدارة الدروس'}</span>
                            </button>
                            {course.lastSyncedAt && (
                              <span className="text-[10px] text-slate-400">
                                مزامنة: {new Date(String(course.lastSyncedAt)).toLocaleDateString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {course.level === 'beginner' ? 'مبتدئ' : course.level === 'intermediate' ? 'متوسط' : course.level === 'advanced' ? 'متقدم' : 'الكل'}
                        </td>

                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {course.instructor || '—'}
                        </td>

                        <td className="p-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              course.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', course.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500')} />
                            {course.status === 'published' ? 'منشورة' : 'مسودة'}
                          </span>
                        </td>

                        <td className="p-4 text-left">
                          <div className="flex items-center justify-end gap-1">
                            {hasYoutube && (
                              <button
                                onClick={() => handleSyncPlaylist(course)}
                                disabled={isSyncing}
                                title="مزامنة قائمة التشغيل من YouTube"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                              </button>
                            )}

                            <Link
                              to={`/courses/${course.id}/learn`}
                              target="_blank"
                              title="معاينة الدورة كطالب"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            <button
                              onClick={() => handleToggleCourseStatus(course)}
                              title={course.status === 'published' ? 'إلغاء النشر' : 'نشر'}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 cursor-pointer"
                            >
                              <Power className={cn('h-4 w-4', course.status === 'published' ? 'text-emerald-600' : 'text-slate-400')} />
                            </button>

                            <button
                              onClick={() => handleOpenEditCourse(course)}
                              title="تعديل"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => {
                                setTargetCourse(course);
                                setShowDeleteCourseModal(true);
                              }}
                              title="حذف"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Course Cards */}
          <div className="lg:hidden space-y-3">
            {filteredCourses.map((course) => {
              const isSyncing = syncingCourseId === course.id;
              const ytUrl = getCourseYoutubeUrl(course);
              const hasYoutube = Boolean(ytUrl);

              return (
                <div
                  key={`m-${course.id}`}
                  className="card p-4 rounded-2xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={course.thumbnailUrl}
                        alt=""
                        className="w-12 h-10 rounded-lg object-cover shrink-0"
                      />
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{course.title}</h3>
                        <span className="text-[10px] text-purple-600 font-bold">{course.categoryName}</span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        course.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      )}
                    >
                      {course.status === 'published' ? 'منشورة' : 'مسودة'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => handleOpenLessonsModal(course)}
                      className="text-xs font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)] flex items-center gap-1"
                    >
                      <ListVideo className="h-3.5 w-3.5" />
                      <span>{course.totalLessons ? `${course.totalLessons} درس` : 'إدارة الدروس'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {hasYoutube && (
                        <button
                          onClick={() => handleSyncPlaylist(course)}
                          disabled={isSyncing}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600"
                        >
                          <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                        </button>
                      )}
                      <Link
                        to={`/courses/${course.id}/learn`}
                        target="_blank"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleToggleCourseStatus(course)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditCourse(course)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setTargetCourse(course);
                          setShowDeleteCourseModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TAB 2: DYNAMIC CATEGORIES MANAGEMENT */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catCourseCount = courses.filter((c) => c.categoryName?.toLowerCase() === cat.name.toLowerCase()).length;

              return (
                <div
                  key={cat.id}
                  className="card p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-xs"
                        style={{ backgroundColor: cat.color || '#7C00FE' }}
                      >
                        {cat.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                          {cat.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {catCourseCount} دورة مسجلة
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCat(cat)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 cursor-pointer"
                        title="تعديل التصنيف"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setTargetCat(cat);
                          setShowDeleteCatModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                        title="حذف التصنيف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Course Modal */}
      <Modal
        open={showCourseModal}
        onClose={() => {
          setShowCourseModal(false);
          resetCourseForm();
        }}
        title={editingCourse ? 'تعديل الدورة التعليمية' : 'إضافة دورة تعليمية جديدة (مجانية)'}
        size="lg"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4 text-right font-sans">
          <Input
            label="عنوان الدورة *"
            placeholder="مثال: مدخل إلى الأمن السيبراني والحماية الرقمية"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <Textarea
            label="شرح ومنهج الدورة *"
            placeholder="اكتب نبذة شاملة عن محاور الدورة وما سيتعلمه عضو الفريق..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            required
          />

          {/* Dynamic Category Input / Selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              التصنيف / المجال التعليمي * (اختر أو اكتب تصنيفاً جديداً)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="مثال: الذكاء الاصطناعي، البرمجة، التسويق..."
                value={formCategoryName}
                onChange={(e) => setFormCategoryName(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
                required
              />
              <select
                onChange={(e) => {
                  if (e.target.value) setFormCategoryName(e.target.value);
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
              >
                <option value="">اختر من القائمة</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* YouTube Playlist URL */}
          <div className="space-y-1">
            <Input
              label="رابط قائمة تشغيل YouTube (اختياري - YouTube Playlist URL)"
              placeholder="https://www.youtube.com/playlist?list=PL..."
              value={formYoutubeUrl}
              onChange={(e) => setFormYoutubeUrl(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              سيتم استخراج غلاف قائمة التشغيل ودمج مشغل الفيديو تلقائياً فور إدخال الرابط.
            </p>
          </div>

          {/* External Link & Custom Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="رابط المنصة / المادة الخارجية (اختياري)"
              placeholder="https://example.com/course"
              value={formExternalUrl}
              onChange={(e) => setFormExternalUrl(e.target.value)}
            />

            <Input
              label="رابط صورة مخصصة للغلاف (اختياري)"
              placeholder="https://images.unsplash.com/..."
              value={formThumbnailUrl}
              onChange={(e) => setFormThumbnailUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="المستوى المستهدف"
              value={formLevel}
              onChange={(e) => setFormLevel(e.target.value as CourseLevel)}
              options={[
                { value: 'all', label: 'جميع المستويات' },
                { value: 'beginner', label: 'مبتدئ (Beginner)' },
                { value: 'intermediate', label: 'متوسط (Intermediate)' },
                { value: 'advanced', label: 'متقدم (Advanced)' },
              ]}
            />

            <Input
              label="المدة / عدد الدروس"
              placeholder="مثال: 5 ساعات / 14 درس"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
            />

            <Input
              label="اسم المحاضر / المدرب"
              placeholder="مثال: م. أحمد عبد الله"
              value={formInstructor}
              onChange={(e) => setFormInstructor(e.target.value)}
            />
          </div>

          <Select
            label="حالة النشر"
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as CourseStatus)}
            options={[
              { value: 'published', label: 'منشورة ومتاحة للموظفين (Published)' },
              { value: 'draft', label: 'مسودة للإدارة فقط (Draft)' },
              { value: 'unpublished', label: 'غير منشورة (Unpublished)' },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCourseModal(false);
                resetCourseForm();
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
              {editingCourse ? 'حفظ التعديلات' : 'نشر الدورة التعليمية'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Category Modal */}
      <Modal
        open={showCatModal}
        onClose={() => {
          setShowCatModal(false);
          resetCatForm();
        }}
        title={editingCat ? 'تعديل التصنيف' : 'إضافة تصنيف تعليمي جديد'}
        size="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-right font-sans">
          <Input
            label="اسم التصنيف *"
            placeholder="مثال: الذكاء الاصطناعي وتعلم الآلة"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />

          <Textarea
            label="وصف التصنيف (اختياري)"
            placeholder="اكتب وصفاً موجزاً لما يتضمنه هذا التصنيف..."
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
          />

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              لون التصنيف المميز
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200"
              />
              <Input
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCatModal(false);
                resetCatForm();
              }}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="btn-primary font-extrabold"
            >
              {editingCat ? 'حفظ التعديلات' : 'إضافة التصنيف'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Course Confirm */}
      <ConfirmDialog
        open={showDeleteCourseModal}
        onClose={() => setShowDeleteCourseModal(false)}
        onConfirm={handleDeleteCourse}
        title="حذف الدورة التعليمية"
        description={`هل أنت متأكد من حذف الدورة "${targetCourse?.title}"؟ لن تعود متاحة للموظفين.`}
        confirmLabel="حذف الدورة"
        cancelLabel="إلغاء"
        variant="danger"
        loading={submitting}
      />

      {/* Manage Lessons Modal */}
      <Modal
        open={showLessonsModal}
        onClose={() => {
          setShowLessonsModal(false);
          setSelectedCourseForLessons(null);
        }}
        title={`إدارة دروس: ${selectedCourseForLessons?.title || ''}`}
        size="xl"
      >
        {selectedCourseForLessons && (
          <div className="space-y-4 text-right font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  إجمالي الدروس المستوردة: <strong>{courseLessons.length} درس</strong>
                </p>
                {getCourseYoutubeUrl(selectedCourseForLessons) && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                    رابط المحتوى: {getCourseYoutubeUrl(selectedCourseForLessons)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {getCourseYoutubeUrl(selectedCourseForLessons) && (
                  <Button
                    onClick={() => handleSyncPlaylist(selectedCourseForLessons)}
                    disabled={syncingCourseId === selectedCourseForLessons.id}
                    className="btn-primary text-xs font-bold gap-1.5 rounded-xl py-2"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', syncingCourseId === selectedCourseForLessons.id && 'animate-spin')} />
                    <span>مزامنة الفيديوهات الآن</span>
                  </Button>
                )}
                <Link
                  to={`/courses/${selectedCourseForLessons.id}/learn`}
                  target="_blank"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>معاينة المشغل</span>
                </Link>
              </div>
            </div>

            {/* Lessons List */}
            {courseLessons.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <ListVideo className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">
                  لم يتم استيراد أي دروس بعد لهذه الدورة.
                </p>
                {getCourseYoutubeUrl(selectedCourseForLessons) ? (
                  <Button
                    onClick={() => handleSyncPlaylist(selectedCourseForLessons)}
                    className="btn-primary text-xs"
                  >
                    مزامنة الفيديوهات من YouTube
                  </Button>
                ) : (
                  <p className="text-[11px] text-amber-600">
                    أضف رابط فيديو أو قائمة تشغيل YouTube في بيانات الدورة لمزامنة الدروس تلقائياً.
                  </p>
                )}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-subtle)] card rounded-2xl">
                {courseLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#181824] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center text-xs font-black text-slate-400">
                        {String(lesson.position).padStart(2, '0')}
                      </span>
                      <img
                        src={lesson.thumbnailUrl}
                        alt=""
                        className="w-14 h-9 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {lesson.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ID: {lesson.youtubeVideoId} {lesson.duration && `• ${lesson.duration}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 hover:text-red-600"
                        title="مشاهدة على YouTube"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={async () => {
                          if (confirm(`حذف الدرس رقم ${lesson.position} (${lesson.title})؟`)) {
                            await deleteCourseLesson(selectedCourseForLessons.id, lesson.id, userProfile!);
                            toast.success('تم حذف الدرس');
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
                        title="حذف الدرس"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Category Confirm */}
      <ConfirmDialog
        open={showDeleteCatModal}
        onClose={() => setShowDeleteCatModal(false)}
        onConfirm={handleDeleteCat}
        title="حذف التصنيف"
        description={`هل أنت متأكد من حذف تصنيف "${targetCat?.name}"؟`}
        confirmLabel="حذف التصنيف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}
