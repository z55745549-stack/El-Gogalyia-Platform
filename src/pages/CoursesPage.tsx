import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Search,
  Sparkles,
  ExternalLink,
  PlayCircle,
  Clock,
  BookOpen,
  CheckCircle2,
  User,
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
  subscribeUserAllProgress,
  getCourseYoutubeUrl,
  getCourseDirectYoutubeWatchLink,
} from '@/lib/courses';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/utils';
import type { Course, CourseCategory, CourseLevel, CourseProgress } from '@/types';

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

const LEVEL_LABELS: Record<CourseLevel, { label: string; color: string }> = {
  all: { label: 'جميع المستويات', color: 'bg-slate-500/10 text-slate-400' },
  beginner: { label: 'مبتدئ (Beginner)', color: 'bg-emerald-500/10 text-emerald-400' },
  intermediate: { label: 'متوسط (Intermediate)', color: 'bg-blue-500/10 text-blue-400' },
  advanced: { label: 'متقدم (Advanced)', color: 'bg-purple-500/10 text-purple-400' },
};

export function CoursesPage() {
  const { userProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [userProgressMap, setUserProgressMap] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    let unsubProgress: (() => void) | undefined;

    const unsubCourses = subscribeCourses((list) => {
      setCourses(list);
      setLoading(false);
    }, true);

    const unsubCategories = subscribeCourseCategories((list) => {
      setCategories(list);
    });

    if (userProfile?.uid) {
      unsubProgress = subscribeUserAllProgress(userProfile.uid, (progList) => {
        const map: Record<string, CourseProgress> = {};
        progList.forEach((p) => {
          map[p.courseId] = p;
        });
        setUserProgressMap(map);
      });
    }

    return () => {
      unsubCourses();
      unsubCategories();
      if (unsubProgress) unsubProgress();
    };
  }, [userProfile?.uid]);

  const allDynamicCategoryNames = Array.from(
    new Set([
      ...categories.map((c) => c.name),
      ...courses.map((c) => c.categoryName).filter(Boolean),
    ])
  );

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.categoryName.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructor && c.instructor.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      c.categoryId === selectedCategory ||
      c.categoryName.toLowerCase() === selectedCategory.toLowerCase();

    const matchesLevel = selectedLevel === 'all' || (c.level || 'all') === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  filteredCourses.sort((a, b) => {
    if (sortBy === 'newest') {
      const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date((a.createdAt as any) || 0).getTime();
      const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date((b.createdAt as any) || 0).getTime();
      return tB - tA;
    }
    if (sortBy === 'oldest') {
      const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date((a.createdAt as any) || 0).getTime();
      const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date((b.createdAt as any) || 0).getTime();
      return tA - tB;
    }
    if (sortBy === 'az') return a.title.localeCompare(b.title, 'ar');
    if (sortBy === 'za') return b.title.localeCompare(a.title, 'ar');
    return 0;
  });

  return (
    <div className="space-y-6 font-sans dir-rtl text-right animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl card-aurora p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-accent)]/20 backdrop-blur-md text-xs font-black border border-[var(--brand-accent)]/30 text-[var(--brand-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>مجانية 100% لأعضاء منصة الجوجالية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              الدورات والمسارات التعليمية
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              طور مهاراتك التقنية والإدارية مع باقة مختارة من الدورات المعتمدة، قوائم تشغيل YouTube، والمصادر التعليمية التخصصية.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--brand-accent)]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">الدورات المتاحة</p>
              <p className="text-xl font-black text-white">{courses.length} دورة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Category Chips Bar */}
      <div className="card p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 w-full no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5',
                selectedCategory === 'all'
                  ? 'btn-primary shadow-md shadow-[var(--brand-primary)]/25'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              )}
            >
              <span>جميع التصنيفات</span>
              <span className="text-[10px] opacity-80">({courses.length})</span>
            </button>

            {allDynamicCategoryNames.map((catName) => {
              const count = courses.filter(
                (c) => c.categoryName?.toLowerCase() === catName.toLowerCase()
              ).length;
              if (count === 0 && selectedCategory !== catName) return null;

              return (
                <button
                  key={catName}
                  onClick={() => setSelectedCategory(catName)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5',
                    selectedCategory.toLowerCase() === catName.toLowerCase()
                      ? 'btn-primary shadow-md shadow-[var(--brand-primary)]/25'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                  )}
                >
                  <span>{catName}</span>
                  <span className="text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search, Level & Sort Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم الدورة، الموضوع، أو المدرب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">الترتيب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-hidden"
              >
                <option value="newest">الأحدث إضافة</option>
                <option value="oldest">الأقدم</option>
                <option value="az">أبجدياً (أ - ي)</option>
                <option value="za">أبجدياً (ي - أ)</option>
              </select>
            </div>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-hidden"
            >
              <option value="all">جميع المستويات</option>
              <option value="beginner">مبتدئ</option>
              <option value="intermediate">متوسط</option>
              <option value="advanced">متقدم</option>
            </select>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 rounded-2xl space-y-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <EmptyState
            icon={<GraduationCap className="h-10 w-10 text-slate-400" />}
            title="لم يتم العثور على دورات تعليمية"
            description={
              search || selectedCategory !== 'all' || selectedLevel !== 'all'
                ? 'لا توجد دورات تطابق معايير البحث أو التصفية الحالية. جرب تغيير التصنيف أو البحث بكلمات أخرى.'
                : 'سيتم نشر دورات ومسارات تعليمية جديدة قريباً من قِبل إدارة منصة الجوجالية.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const ytUrl = getCourseYoutubeUrl(course);
            const directYtWatchLink = getCourseDirectYoutubeWatchLink(course);
            const hasYoutube = Boolean(ytUrl);
            const levelInfo = LEVEL_LABELS[course.level || 'all'] || LEVEL_LABELS.all;
            const courseProg = userProgressMap[course.id];
            const isStarted = Boolean(
              courseProg &&
                (courseProg.completedCount > 0 ||
                  Object.keys(courseProg.lessonProgress || {}).length > 0)
            );
            const isDone = Boolean(courseProg?.isCompleted);
            const percent = courseProg?.percentCompleted || 0;
            const completedCount = courseProg?.completedCount || 0;
            const totalCount = course.totalLessons || (courseProg?.totalLessons) || 1;

            return (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card rounded-2xl shadow-xs hover:shadow-lg hover:border-[var(--brand-primary)]/40 transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Thumbnail / Cover Link */}
                <Link
                  to={`/courses/${course.id}/learn`}
                  className="relative h-44 bg-slate-100 dark:bg-white/5 overflow-hidden block"
                >
                  <img
                    src={
                      course.thumbnailUrl ||
                      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80'
                    }
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
                    }}
                  />

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-xl shadow-md text-xs font-black backdrop-blur-md">
                    {isDone ? (
                      <span className="bg-emerald-600/90 text-white px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>مكتملة 🎉</span>
                      </span>
                    ) : isStarted ? (
                      <span className="bg-[var(--brand-primary)]/90 text-white px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
                        <span>{percent}% مكتمل</span>
                      </span>
                    ) : (
                      <span className="bg-emerald-600/90 text-white px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>مجاناً FREE</span>
                      </span>
                    )}
                  </div>

                  {/* Category Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white border border-white/10">
                      {course.categoryName}
                    </span>
                  </div>

                  {/* Play icon overlay if youtube */}
                  {hasYoutube && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-bold shadow-md">
                      <YoutubeIcon className="h-3.5 w-3.5" />
                      <span>{course.totalLessons ? `${course.totalLessons} درس` : 'YouTube'}</span>
                    </div>
                  )}
                </Link>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', levelInfo.color)}>
                        {levelInfo.label}
                      </span>
                      {course.duration && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {course.duration}
                        </span>
                      )}
                    </div>

                    <Link to={`/courses/${course.id}/learn`} className="block">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 group-hover:text-[var(--brand-primary)] dark:group-hover:text-[var(--brand-accent)] transition-colors line-clamp-1">
                        {course.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>

                  {/* Progress bar if started */}
                  {isStarted && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                        <span>التقدم في المشاهدة</span>
                        <span className="text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                          {completedCount} / {totalCount} درس ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Instructor / Quick Info */}
                  {course.instructor && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate font-medium">{course.instructor}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-2">
                    <Link
                      to={`/courses/${course.id}/learn`}
                      className={cn(
                        'flex-1 w-full gap-1.5 text-xs font-bold py-2.5 px-3 rounded-xl shadow-xs inline-flex items-center justify-center transition-all cursor-pointer text-center',
                        isDone
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'btn-primary'
                      )}
                    >
                      <PlayCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {isDone ? 'مراجعة على المنصة' : isStarted ? 'متابعة على المنصة' : 'التعلم على المنصة'}
                      </span>
                    </Link>

                    {hasYoutube && directYtWatchLink && (
                      <a
                        href={directYtWatchLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
                        title="مشاهدة مباشرة على يوتيوب في صفحة خارجية"
                      >
                        <YoutubeIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="text-[11px] whitespace-nowrap">YouTube</span>
                        <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
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
