import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Play,
  CheckCircle2,
  Lock,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  Clock,
  AlertCircle,
  RotateCcw,
  ListVideo,
  Award,
  ExternalLink,
  ShieldCheck,
  Check,
  Menu,
  X
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
  subscribeCourse,
  subscribeCourseLessons,
  subscribeUserCourseProgress,
  saveLessonWatchTime,
  completeLesson,
  resetCourseProgress,
  getCourseYoutubeUrl,
  getCourseDirectYoutubeWatchLink,
  autoEnsureCourseLessons,
  extractYouTubeVideoId,
} from '@/lib/courses';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { Course, CourseLesson, CourseProgress } from '@/types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function CoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Lesson
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // YouTube Player State
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);

  // Mobile Playlist Drawer
  const [mobilePlaylistOpen, setMobilePlaylistOpen] = useState(false);

  // Completion Modals & Banners
  const [showLessonCompletedToast, setShowLessonCompletedToast] = useState(false);
  const [showCourseCompletedModal, setShowCourseCompletedModal] = useState(false);

  // 1. Subscriptions: Course, Lessons, Progress
  useEffect(() => {
    if (!courseId) return;

    let unsubProgress: (() => void) | undefined;

    const unsubCourse = subscribeCourse(courseId, (c) => {
      setCourse(c);
      setLoading(false);
    });

    const unsubLessons = subscribeCourseLessons(courseId, (lesList) => {
      if (lesList.length > 0) {
        setLessons(lesList);
      }
    });

    if (userProfile?.uid) {
      unsubProgress = subscribeUserCourseProgress(userProfile.uid, courseId, (prog) => {
        setProgress(prog);
      });
    }

    return () => {
      unsubCourse();
      unsubLessons();
      if (unsubProgress) unsubProgress();
    };
  }, [courseId, userProfile?.uid]);

  // 1b. Auto-ensure lessons for legacy / manual course links so they play immediately
  useEffect(() => {
    if (!course || loading) return;

    if (lessons.length === 0) {
      const ytUrl = getCourseYoutubeUrl(course);
      const vId = extractYouTubeVideoId(ytUrl);
      if (vId) {
        // Synthesize temporary lesson immediately so player loads without blank screen
        const tempLesson: CourseLesson = {
          id: `les_temp_${course.id}`,
          courseId: course.id,
          youtubeVideoId: vId,
          title: course.title || 'الدرس الأول (فيديو تعليمي)',
          description: course.description || '',
          thumbnailUrl: course.thumbnailUrl || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
          position: 1,
          status: 'available',
          duration: course.duration || 'فيديو تعليمي',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setLessons([tempLesson]);
        setActiveLessonId(tempLesson.id);
      }

      // Ensure persistence in Firestore in background
      autoEnsureCourseLessons(course, userProfile).then((ensured) => {
        if (ensured.length > 0) {
          setLessons(ensured);
        }
      });
    }
  }, [course?.id, lessons.length, loading]);

  // 2. Select initial active lesson based on saved progress or first lesson
  useEffect(() => {
    if (lessons.length === 0) return;

    if (!activeLessonId) {
      const completedSet = new Set(progress?.completedLessonIds || []);

      // If progress has a currentLessonId and it's unlocked, use it
      if (progress?.currentLessonId) {
        const targetLesson = lessons.find((l) => l.id === progress.currentLessonId);
        if (targetLesson) {
          const targetIndex = lessons.indexOf(targetLesson);
          const isUnlocked = targetIndex === 0 || completedSet.has(lessons[targetIndex - 1].id);
          if (isUnlocked) {
            setActiveLessonId(targetLesson.id);
            return;
          }
        }
      }

      // Otherwise find first incomplete unlocked lesson
      for (let i = 0; i < lessons.length; i++) {
        if (!completedSet.has(lessons[i].id)) {
          setActiveLessonId(lessons[i].id);
          return;
        }
      }

      // If all completed, select first lesson
      setActiveLessonId(lessons[0].id);
    }
  }, [lessons, progress, activeLessonId]);

  const activeLesson = lessons.find((l) => l.id === activeLessonId) || lessons[0];
  const activeLessonIndex = lessons.findIndex((l) => l.id === activeLesson?.id);

  const completedLessonIds = progress?.completedLessonIds || [];
  const isLessonCompleted = (lessonId: string) => completedLessonIds.includes(lessonId);

  const isLessonUnlocked = (lessonIndex: number) => {
    if (lessonIndex === 0) return true;
    const prevLesson = lessons[lessonIndex - 1];
    return prevLesson ? isLessonCompleted(prevLesson.id) : false;
  };

  // 3. Initialize YouTube Iframe API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 4. Mount / update YouTube Player when activeLesson changes
  useEffect(() => {
    if (!activeLesson?.youtubeVideoId) return;

    setPlayerError(null);
    setPlayerReady(false);
    setShowLessonCompletedToast(false);

    let isMounted = true;

    const setupPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(setupPlayer, 200);
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }

      const savedTime = progress?.lessonProgress?.[activeLesson.id]?.watchedSeconds || 0;

      try {
        playerRef.current = new window.YT.Player('youtube-player-element', {
          videoId: activeLesson.youtubeVideoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            start: savedTime > 5 ? savedTime : undefined,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setPlayerReady(true);
              if (savedTime > 5) {
                try {
                  event.target.seekTo(savedTime, true);
                } catch (e) {
                  // ignore
                }
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                saveCurrentWatchTime();
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                handleLessonFinished();
              }
            },
            onError: (event: any) => {
              if (!isMounted) return;
              console.warn('YouTube Player error code:', event.data);
              if (event.data === 101 || event.data === 150) {
                setPlayerError('عذراً، صاحب هذا الفيديو قام بتعطيل تشغيله داخل المواقع الأخرى.');
              } else if (event.data === 100 || event.data === 2) {
                setPlayerError('هذا الفيديو غير متوفر أو تم حذفه من قِبل المصدر.');
              } else {
                setPlayerError('حدث خطأ أثناء تشغيل الفيديو من يوتيوب.');
              }
            },
          },
        });
      } catch (err) {
        console.error('Error creating YT.Player:', err);
      }
    };

    setupPlayer();

    return () => {
      isMounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [activeLesson?.id, activeLesson?.youtubeVideoId]);

  // 5. Periodic Watch Position Tracking
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      saveCurrentWatchTime();
    }, 12000); // every 12 seconds

    return () => clearInterval(interval);
  }, [isPlaying, activeLesson?.id]);

  const saveCurrentWatchTime = () => {
    if (!playerRef.current || !activeLesson || !userProfile || !courseId) return;
    try {
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 0) {
          saveLessonWatchTime({
            userId: userProfile.uid,
            userEmail: userProfile.email || '',
            userName: userProfile.displayName || '',
            courseId,
            lessonId: activeLesson.id,
            lessonPosition: activeLesson.position,
            watchedSeconds: currentTime,
            totalLessons: lessons.length,
          });
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // 6. Handle Video Completion (Auto or Button)
  const handleLessonFinished = async () => {
    if (!activeLesson || !userProfile || !courseId || completingLesson) return;

    setCompletingLesson(true);
    try {
      const result = await completeLesson({
        userId: userProfile.uid,
        userEmail: userProfile.email || '',
        userName: userProfile.displayName || '',
        courseId,
        lessonId: activeLesson.id,
        lessonPosition: activeLesson.position,
        totalLessons: lessons.length,
      });

      setShowLessonCompletedToast(true);
      toast.success(`أحسنت! تم إكمال ${activeLesson.title} بنجاح ✓`);

      // Check if all lessons are now completed
      if (result.progress.isCompleted) {
        setShowCourseCompletedModal(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ التقدم');
    } finally {
      setCompletingLesson(false);
    }
  };

  // Navigation handlers
  const handleSelectLesson = (lesson: CourseLesson, index: number) => {
    if (!isLessonUnlocked(index)) {
      toast.error('هذا الدرس مقفل حالياً. يجب إكمال الدروس السابقة أولاً للوصول إليه 🔒');
      return;
    }
    saveCurrentWatchTime();
    setActiveLessonId(lesson.id);
    setMobilePlaylistOpen(false);
  };

  const handleNextLesson = () => {
    if (activeLessonIndex < lessons.length - 1) {
      const nextIndex = activeLessonIndex + 1;
      if (isLessonUnlocked(nextIndex)) {
        handleSelectLesson(lessons[nextIndex], nextIndex);
      } else {
        toast.error('يرجى إكمال الدرس الحالي أولاً لفتح الدرس التالي 🔒');
      }
    }
  };

  const handlePrevLesson = () => {
    if (activeLessonIndex > 0) {
      const prevIndex = activeLessonIndex - 1;
      handleSelectLesson(lessons[prevIndex], prevIndex);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0E0E14] flex flex-col p-4 sm:p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          <Skeleton className="lg:col-span-2 h-[500px] rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">الدورة غير موجودة أو تم حذفها</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          تأكد من صحة الرابط أو تصفح الدورات التدريبية المجانية المتاحة للموظفين.
        </p>
        <Button onClick={() => navigate('/courses')} className="mt-4 btn-primary text-white">
          العودة لقائمة الدورات
        </Button>
      </div>
    );
  }

  const completedCount = progress?.completedCount || 0;
  const totalLessonsCount = lessons.length;
  const percentCompleted = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;
  const isFinalCourseCompleted = progress?.isCompleted || (completedCount >= totalLessonsCount && totalLessonsCount > 0);
  const directYtWatchLink = getCourseDirectYoutubeWatchLink(course);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[var(--bg-base)] font-sans dir-rtl text-right text-slate-900 dark:text-slate-100 flex flex-col">
      {/* ─── Top Header Bar ─── */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[var(--surface)]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/courses"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="العودة إلى الدورات"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                {course.categoryName || 'دورة تعليمية مجانية'}
              </span>
              {isFinalCourseCompleted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Award className="h-3 w-3" />
                  <span>دورة مكتملة</span>
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-extrabold truncate text-slate-900 dark:text-slate-100 mt-0.5">
              {course.title}
            </h1>
          </div>
        </div>

        {/* YouTube Switcher & Progress Pill & Mobile Playlist Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          {directYtWatchLink && (
            <a
              href={directYtWatchLink}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0"
              title="مشاهدة مباشرة على YouTube في نافذة خارجية"
            >
              <YoutubeIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="hidden md:inline text-[11px]">المشاهدة على YouTube</span>
              <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
            </a>
          )}

          <div className="hidden sm:flex items-center gap-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3.5 py-1.5 rounded-xl">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium">التقدم في الدورة</p>
              <p className="text-xs font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                {completedCount} / {totalLessonsCount} درس ({percentCompleted}%)
              </p>
            </div>
            <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] transition-all duration-500 rounded-full"
                style={{ width: `${percentCompleted}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setMobilePlaylistOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ListVideo className="h-4 w-4" />
            <span>قائمة الدروس ({totalLessonsCount})</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content (2-Column Layout) ─── */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Center Area: Video Player & Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player Box */}
          <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-xl border border-slate-800">
            {activeLesson ? (
              <>
                <div id="youtube-player-element" className="w-full h-full" />

                {playerError && (
                  <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
                    <AlertCircle className="h-10 w-10 text-rose-400" />
                    <h3 className="text-base font-bold">{playerError}</h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      يمكنك تجربة فتح الفيديو على يوتيوب مباشرة أو الانتقال للدرس التالي للمتابعة.
                    </p>
                    <div className="flex gap-2 pt-2">
                      <a
                        href={`https://www.youtube.com/watch?v=${activeLesson.youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold inline-flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>فتح على يوتيوب</span>
                      </a>
                      <Button
                        onClick={handleLessonFinished}
                        className="btn-accent text-xs font-bold"
                      >
                        تخطي واحتساب كـ مكتمل
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <BookOpen className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm font-bold">لا توجد دروس متوفرة في هذه الدورة حالياً</p>
              </div>
            )}
          </div>

          {/* Lesson Info & Progress Banner */}
          {activeLesson && (
            <div className="card p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                      الدرس {activeLesson.position} من {totalLessonsCount}
                    </span>
                    {isLessonCompleted(activeLesson.id) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>تم إكمال هذا الدرس</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                    {activeLesson.title}
                  </h2>
                </div>

                {/* Mark as Complete Button */}
                {!isLessonCompleted(activeLesson.id) ? (
                  <Button
                    onClick={handleLessonFinished}
                    loading={completingLesson}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>تأكيد إكمال الدرس ✓</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>مكتمل بنجاح</span>
                  </div>
                )}
              </div>

              {activeLesson.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-white/5 pt-3">
                  {activeLesson.description}
                </p>
              )}

              {/* Navigation Controls (Prev / Next) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                <Button
                  variant="outline"
                  onClick={handlePrevLesson}
                  disabled={activeLessonIndex <= 0}
                  className="gap-1.5 text-xs rounded-xl cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span>الدرس السابق</span>
                </Button>

                {activeLessonIndex < totalLessonsCount - 1 ? (
                  <Button
                    onClick={handleNextLesson}
                    disabled={!isLessonUnlocked(activeLessonIndex + 1)}
                    className={cn(
                      'gap-1.5 text-xs rounded-xl font-bold cursor-pointer',
                      isLessonUnlocked(activeLessonIndex + 1)
                        ? 'btn-primary'
                        : 'opacity-60'
                    )}
                  >
                    <span>الدرس التالي</span>
                    {isLessonUnlocked(activeLessonIndex + 1) ? (
                      <ChevronLeft className="h-4 w-4" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowCourseCompletedModal(true)}
                    disabled={!isFinalCourseCompleted}
                    className="gap-1.5 text-xs rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Award className="h-4 w-4" />
                    <span>إكمال الدورة 🎉</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Success Banner when Lesson Completed */}
          <AnimatePresence>
            {showLessonCompletedToast && activeLessonIndex < totalLessonsCount - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm">ممتاز! تم فتح الدرس التالي</h4>
                    <p className="text-xs text-white/90">
                      تم تسجيل إنجازك لهذا الدرس وحفظه في سجل تدريبك.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleNextLesson}
                  className="bg-white text-emerald-800 hover:bg-white/90 font-black text-xs px-4 py-2 rounded-xl shrink-0"
                >
                  الانتقال للدرس التالي ←
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right Column: Lesson Playlist (Desktop) ─── */}
        <div className="hidden lg:block space-y-4">
          <div className="bg-white dark:bg-[#13131A] rounded-2xl border border-slate-200/80 dark:border-[#2A2A35] shadow-xs flex flex-col h-[640px] sticky top-20">
            {/* Playlist Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
                  <span>محتوى الدورة التدريبية</span>
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                  {completedCount} / {totalLessonsCount} مكتمل
                </span>
              </div>

              {/* Mini progress line */}
              <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] transition-all duration-300 rounded-full"
                  style={{ width: `${percentCompleted}%` }}
                />
              </div>
            </div>

            {/* Playlist Items Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y-0">
              {lessons.map((lesson, index) => {
                const isActive = lesson.id === activeLesson?.id;
                const isCompleted = isLessonCompleted(lesson.id);
                const isUnlocked = isLessonUnlocked(index);

                return (
                  <button
                    key={lesson.id}
                    onClick={() => handleSelectLesson(lesson, index)}
                    disabled={!isUnlocked}
                    className={cn(
                      'w-full text-right p-3 rounded-xl transition-all flex items-start gap-3 relative cursor-pointer',
                      isActive
                        ? 'bg-[var(--brand-primary)]/15 border-2 border-[var(--brand-primary)] dark:border-[var(--brand-accent)] shadow-xs'
                        : isUnlocked
                        ? 'hover:bg-slate-100/80 dark:hover:bg-white/5 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5'
                        : 'opacity-50 bg-slate-100/40 dark:bg-white/[0.01] border border-transparent cursor-not-allowed'
                    )}
                  >
                    {/* Status Icon / Number */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs',
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : isActive
                          ? 'btn-primary'
                          : isUnlocked
                          ? 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                          : 'bg-slate-200/60 dark:bg-white/5 text-slate-400'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4 stroke-[3]" />
                      ) : isActive ? (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      ) : isUnlocked ? (
                        <span>{String(lesson.position).padStart(2, '0')}</span>
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Lesson Details */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-xs font-bold leading-tight line-clamp-2',
                          isActive
                            ? 'text-[var(--brand-primary)] dark:text-[var(--brand-accent)]'
                            : isUnlocked
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-500'
                        )}
                      >
                        {lesson.title}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                        {lesson.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{lesson.duration}</span>
                          </span>
                        )}
                        {!isUnlocked && <span className="text-amber-500 font-medium">🔒 مقفل</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile Playlist Drawer ─── */}
      <AnimatePresence>
        {mobilePlaylistOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobilePlaylistOpen(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 card rounded-t-3xl border-t border-slate-200 dark:border-white/10 max-h-[80vh] flex flex-col p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-[var(--brand-primary)]" />
                  <span>قائمة دروس الدورة ({totalLessonsCount})</span>
                </h3>
                <button
                  onClick={() => setMobilePlaylistOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {lessons.map((lesson, index) => {
                  const isActive = lesson.id === activeLesson?.id;
                  const isCompleted = isLessonCompleted(lesson.id);
                  const isUnlocked = isLessonUnlocked(index);

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => handleSelectLesson(lesson, index)}
                      disabled={!isUnlocked}
                      className={cn(
                        'w-full text-right p-3 rounded-xl transition-all flex items-center gap-3',
                        isActive
                          ? 'bg-[var(--brand-primary)]/15 border-2 border-[var(--brand-primary)]'
                          : isUnlocked
                          ? 'bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5'
                          : 'opacity-40 bg-slate-100/50 dark:bg-white/[0.01] cursor-not-allowed'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isActive
                            ? 'btn-primary'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">
                          {lesson.title}
                        </p>
                      </div>

                      {!isUnlocked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Course Completion Modal ─── */}
      <Modal
        open={showCourseCompletedModal}
        onClose={() => setShowCourseCompletedModal(false)}
        title="تهانينا! لقد أتممت الدورة التدريبية 🎉"
        size="md"
      >
        <div className="space-y-5 text-center font-sans py-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[var(--brand-primary)] to-[var(--brand-accent)] text-white flex items-center justify-center mx-auto shadow-xl">
            <Award className="h-10 w-10" />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              إنجاز رائع ومتميز!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              لقد أتممت بنجاح جميع دروس دورة <strong className="text-slate-800 dark:text-slate-200">"{course.title}"</strong> ({totalLessonsCount} درس).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 space-y-1">
            <p className="text-xs font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
              تم تسجيل إتمام الدورة بنسبة 100% في ملفك التدريبي الداخلي
            </p>
            <p className="text-[11px] text-slate-400">
              يمكنك مراجعة أي درس في أي وقت مجاناً.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => navigate('/courses')}
              className="flex-1 btn-primary font-bold text-xs py-2.5 rounded-xl"
            >
              استكشاف دورات أخرى
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCourseCompletedModal(false)}
              className="rounded-xl text-xs"
            >
              البقاء ومراجعة الدروس
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
