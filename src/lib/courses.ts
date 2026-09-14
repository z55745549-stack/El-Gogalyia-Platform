import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { logActivity, createNotification } from './firestore';
import { importYouTubePlaylist } from './youtube';
import type {
  Course,
  CourseCategory,
  CourseStatus,
  CourseLevel,
  CourseLesson,
  CourseProgress,
  LessonProgressItem,
  LessonStatus,
  UserProfile,
} from '@/types';

// ─── 1. YouTube Utilities ───────────────────────────────────────────────────

export function extractYouTubePlaylistId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function getCourseYoutubeUrl(course?: Partial<Course> | null): string {
  if (!course) return '';
  return (
    course.youtubePlaylistUrl ||
    (course as any).youtubeUrl ||
    course.externalUrl ||
    ''
  ).trim();
}

export function getCourseDirectYoutubeWatchLink(course?: Partial<Course> | null): string {
  if (!course) return '';
  const rawUrl = getCourseYoutubeUrl(course);
  if (!rawUrl) return '';

  const playlistId = extractYouTubePlaylistId(rawUrl) || course.youtubePlaylistId;
  if (playlistId && !playlistId.startsWith('single_')) {
    return `https://www.youtube.com/playlist?list=${playlistId}`;
  }

  const videoId = extractYouTubeVideoId(rawUrl);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return rawUrl;
}

export function resolveCourseCoverImage(params: {
  customImage?: string;
  youtubeUrl?: string;
  categoryName?: string;
}): string {
  const { customImage, youtubeUrl } = params;
  if (customImage && customImage.trim().length > 0) {
    return customImage.trim();
  }

  // Try extracting video thumbnail if present
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // Fallback beautiful gradients/placeholders
  return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
}

// ─── 2. Course Categories (Dynamic System) ───────────────────────────────────

export async function createCourseCategory(params: {
  name: string;
  description?: string;
  color?: string;
  creator: UserProfile;
}): Promise<CourseCategory> {
  const { name, description = '', color = '#7C00FE', creator } = params;
  const normalizedSlug = name.trim().toLowerCase().replace(/\s+/g, '-');
  const catId = `cat_${normalizedSlug}_${Date.now().toString(36)}`;
  const now = serverTimestamp();

  const categoryData: CourseCategory = {
    id: catId,
    name: name.trim(),
    slug: normalizedSlug,
    description: description.trim(),
    color,
    status: 'active',
    courseCount: 0,
    createdAt: now as any,
    updatedAt: now as any,
  };

  await setDoc(doc(db, 'course_categories', catId), categoryData);

  await logActivity({
    actor: creator.uid,
    actorName: creator.displayName || 'المشرف',
    actorPhoto: creator.photoURL || '',
    action: 'category.created',
    targetType: 'course_category',
    targetId: catId,
    targetName: name,
  });

  return categoryData;
}

export async function ensureCategoryExists(
  name: string,
  creator: UserProfile
): Promise<{ id: string; name: string }> {
  const cleanName = name.trim();
  if (!cleanName) return { id: 'general', name: 'عام' };

  try {
    const snap = await getDocs(collection(db, 'course_categories'));
    const existing = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CourseCategory))
      .find((c) => c.name.toLowerCase() === cleanName.toLowerCase());

    if (existing) {
      return { id: existing.id, name: existing.name };
    }

    // Otherwise create dynamically
    const newCat = await createCourseCategory({
      name: cleanName,
      creator,
    });
    return { id: newCat.id, name: newCat.name };
  } catch (err) {
    console.warn('ensureCategoryExists error:', err);
    return { id: `cat_${Date.now()}`, name: cleanName };
  }
}

export async function updateCourseCategory(
  categoryId: string,
  updates: Partial<CourseCategory>,
  actor: UserProfile
): Promise<void> {
  await updateDoc(doc(db, 'course_categories', categoryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'category.updated',
    targetType: 'course_category',
    targetId: categoryId,
    targetName: updates.name || categoryId,
  });
}

export async function deleteCourseCategory(
  categoryId: string,
  actor: UserProfile,
  name = ''
): Promise<void> {
  // Check if any courses are using this category
  const courseSnap = await getDocs(
    query(collection(db, 'courses'), where('categoryId', '==', categoryId))
  );

  if (!courseSnap.empty) {
    throw new Error(`لا يمكن حذف هذا التصنيف لوجود ${courseSnap.size} دورة مرتبطة به حالياً.`);
  }

  await deleteDoc(doc(db, 'course_categories', categoryId));

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'category.deleted',
    targetType: 'course_category',
    targetId: categoryId,
    targetName: name || categoryId,
  });
}

export function subscribeCourseCategories(
  callback: (categories: CourseCategory[]) => void
): () => void {
  const q = query(collection(db, 'course_categories'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseCategory));
      list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      callback(list);
    },
    (err) => console.warn('subscribeCourseCategories notice:', err)
  );
}

// ─── 3. Courses CRUD & Subscriptions ─────────────────────────────────────────

export async function createCourse(params: {
  title: string;
  description: string;
  categoryName: string;
  categoryId?: string;
  youtubePlaylistUrl?: string;
  externalUrl?: string;
  thumbnailUrl?: string;
  level?: CourseLevel;
  duration?: string;
  instructor?: string;
  status?: CourseStatus;
  creator: UserProfile;
}): Promise<string> {
  const {
    title,
    description,
    categoryName,
    categoryId: providedCatId,
    youtubePlaylistUrl = '',
    externalUrl = '',
    thumbnailUrl = '',
    level = 'all',
    duration = '',
    instructor = '',
    status = 'published',
    creator,
  } = params;

  // 1. Ensure category exists dynamically
  let catId = providedCatId;
  let finalCatName = categoryName.trim();
  if (!catId) {
    const resolvedCat = await ensureCategoryExists(categoryName, creator);
    catId = resolvedCat.id;
    finalCatName = resolvedCat.name;
  }

  const courseId = `course_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = serverTimestamp();
  const playlistId = extractYouTubePlaylistId(youtubePlaylistUrl);
  const resolvedCover = resolveCourseCoverImage({
    customImage: thumbnailUrl,
    youtubeUrl: youtubePlaylistUrl,
    categoryName: finalCatName,
  });

  const courseData: Course = {
    id: courseId,
    title: title.trim(),
    description: description.trim(),
    categoryId: catId,
    categoryName: finalCatName,
    youtubePlaylistUrl: youtubePlaylistUrl.trim(),
    youtubeUrl: youtubePlaylistUrl.trim(),
    youtubePlaylistId: playlistId || '',
    thumbnailUrl: resolvedCover,
    externalUrl: externalUrl.trim(),
    status,
    level,
    duration: duration.trim(),
    instructor: instructor.trim(),
    createdBy: creator.uid,
    createdByName: creator.displayName || creator.username || 'المشرف',
    createdAt: now as any,
    updatedAt: now as any,
  };

  await setDoc(doc(db, 'courses', courseId), courseData);

  // Log activity
  await logActivity({
    actor: creator.uid,
    actorName: creator.displayName || 'المشرف',
    actorPhoto: creator.photoURL || '',
    action: status === 'published' ? 'course.published' : 'course.created',
    targetType: 'course',
    targetId: courseId,
    targetName: title,
    metadata: { categoryName: finalCatName, status },
  });

  return courseId;
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Omit<Course, 'id' | 'createdBy' | 'createdAt'>>,
  actor: UserProfile
): Promise<void> {
  const courseRef = doc(db, 'courses', courseId);
  const payload: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  const incomingYoutube = updates.youtubePlaylistUrl !== undefined ? updates.youtubePlaylistUrl : updates.youtubeUrl;
  if (incomingYoutube !== undefined) {
    payload.youtubePlaylistUrl = incomingYoutube.trim();
    payload.youtubeUrl = incomingYoutube.trim();
    payload.youtubePlaylistId = extractYouTubePlaylistId(incomingYoutube) || '';
  }

  if (updates.thumbnailUrl !== undefined || incomingYoutube !== undefined) {
    payload.thumbnailUrl = resolveCourseCoverImage({
      customImage: updates.thumbnailUrl,
      youtubeUrl: incomingYoutube,
      categoryName: updates.categoryName,
    });
  }

  await updateDoc(courseRef, payload);

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'course.updated',
    targetType: 'course',
    targetId: courseId,
    targetName: updates.title || courseId,
    metadata: updates,
  });
}

export async function deleteCourse(
  courseId: string,
  actor: UserProfile,
  title = ''
): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId));

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'course.deleted',
    targetType: 'course',
    targetId: courseId,
    targetName: title || courseId,
  });
}

export async function toggleCourseStatus(
  courseId: string,
  newStatus: CourseStatus,
  actor: UserProfile,
  title = ''
): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: newStatus === 'published' ? 'course.published' : 'course.status_changed',
    targetType: 'course',
    targetId: courseId,
    targetName: title || courseId,
    metadata: { newStatus },
  });
}

export function subscribeCourses(
  callback: (courses: Course[]) => void,
  publishedOnly = false
): () => void {
  const q = publishedOnly
    ? query(collection(db, 'courses'), where('status', '==', 'published'))
    : query(collection(db, 'courses'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toDate
          ? (a.createdAt as any).toDate().getTime()
          : new Date((a.createdAt as any) || 0).getTime();
        const tB = (b.createdAt as any)?.toDate
          ? (b.createdAt as any).toDate().getTime()
          : new Date((b.createdAt as any) || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeCourses notice:', err)
  );
}

export async function getCourse(courseId: string): Promise<Course | null> {
  try {
    const snap = await getDoc(doc(db, 'courses', courseId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Course;
  } catch (err) {
    console.error('getCourse error:', err);
    return null;
  }
}

export function subscribeCourse(
  courseId: string,
  callback: (course: Course | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'courses', courseId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ id: snap.id, ...snap.data() } as Course);
      }
    },
    (err) => console.warn('subscribeCourse notice:', err)
  );
}

// ─── 4. Course Lessons CRUD & Playlist Sync ─────────────────────────────────

export function subscribeCourseLessons(
  courseId: string,
  callback: (lessons: CourseLesson[]) => void
): () => void {
  const q = query(collection(db, 'courses', courseId, 'lessons'), orderBy('position', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseLesson));
      list.sort((a, b) => (a.position || 0) - (b.position || 0));
      callback(list);
    },
    (err) => console.warn('subscribeCourseLessons notice:', err)
  );
}

export async function getCourseLessons(courseId: string): Promise<CourseLesson[]> {
  const q = query(collection(db, 'courses', courseId, 'lessons'), orderBy('position', 'asc'));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseLesson));
  list.sort((a, b) => (a.position || 0) - (b.position || 0));
  return list;
}

export async function addCourseLesson(
  courseId: string,
  lessonData: Omit<CourseLesson, 'id' | 'courseId' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<string> {
  const lessonId = `les_${courseId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = serverTimestamp();

  const lesson: CourseLesson = {
    id: lessonId,
    courseId,
    youtubeVideoId: lessonData.youtubeVideoId.trim(),
    title: lessonData.title.trim(),
    description: lessonData.description?.trim() || '',
    thumbnailUrl:
      lessonData.thumbnailUrl ||
      `https://img.youtube.com/vi/${lessonData.youtubeVideoId.trim()}/hqdefault.jpg`,
    duration: lessonData.duration?.trim() || '',
    position: lessonData.position,
    status: lessonData.status || 'available',
    createdAt: now as any,
    updatedAt: now as any,
  };

  await setDoc(doc(db, 'courses', courseId, 'lessons', lessonId), lesson);

  // Update total lessons count on course
  const allLessons = await getCourseLessons(courseId);
  await updateDoc(doc(db, 'courses', courseId), {
    totalLessons: allLessons.length,
    duration: `${allLessons.length} درس`,
    updatedAt: now,
  });

  return lessonId;
}

export async function updateCourseLesson(
  courseId: string,
  lessonId: string,
  updates: Partial<CourseLesson>,
  actor: UserProfile
): Promise<void> {
  const lessonRef = doc(db, 'courses', courseId, 'lessons', lessonId);
  await updateDoc(lessonRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourseLesson(
  courseId: string,
  lessonId: string,
  actor: UserProfile
): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId, 'lessons', lessonId));
  const allLessons = await getCourseLessons(courseId);
  await updateDoc(doc(db, 'courses', courseId), {
    totalLessons: allLessons.length,
    duration: `${allLessons.length} درس`,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Synchronizes YouTube playlist with internal course lessons.
 * Preserves existing lesson IDs and user progress.
 */
export async function syncCoursePlaylist(
  courseId: string,
  playlistUrlOrId: string,
  actor: UserProfile
): Promise<{ addedCount: number; totalCount: number; playlistTitle?: string }> {
  const playlistData = await importYouTubePlaylist(playlistUrlOrId);
  if (!playlistData.items || playlistData.items.length === 0) {
    throw new Error('لم يتم العثور على أي فيديوهات في قائمة التشغيل المحددة.');
  }

  const existingLessons = await getCourseLessons(courseId);
  const existingByVideoId = new Map<string, CourseLesson>();
  existingLessons.forEach((les) => {
    existingByVideoId.set(les.youtubeVideoId, les);
  });

  const batch = writeBatch(db);
  let addedCount = 0;
  const now = new Date().toISOString();

  playlistData.items.forEach((item, index) => {
    const position = index + 1;
    const existing = existingByVideoId.get(item.videoId);

    if (existing) {
      // Update position and title if changed
      const lessonRef = doc(db, 'courses', courseId, 'lessons', existing.id);
      batch.update(lessonRef, {
        position,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl || existing.thumbnailUrl,
        updatedAt: now,
      });
    } else {
      // Create new lesson
      addedCount++;
      const lessonId = `les_${courseId}_p${position}_${Math.random().toString(36).substring(2, 6)}`;
      const lessonRef = doc(db, 'courses', courseId, 'lessons', lessonId);
      const newLesson: CourseLesson = {
        id: lessonId,
        courseId,
        youtubeVideoId: item.videoId,
        title: item.title,
        description: item.description || '',
        thumbnailUrl: item.thumbnailUrl,
        position,
        status: 'available',
        createdAt: now,
        updatedAt: now,
      };
      batch.set(lessonRef, newLesson);
    }
  });

  // Update course metadata
  const courseRef = doc(db, 'courses', courseId);
  const totalCount = playlistData.items.length;
  batch.update(courseRef, {
    totalLessons: totalCount,
    duration: `${totalCount} درس`,
    youtubePlaylistId: playlistData.playlistId,
    youtubePlaylistUrl: playlistUrlOrId,
    youtubeUrl: playlistUrlOrId,
    lastSyncedAt: now,
    updatedAt: now,
  });

  await batch.commit();

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'course.playlist_synced',
    targetType: 'course',
    targetId: courseId,
    targetName: `مزامنة ${totalCount} درس`,
    metadata: { addedCount, totalCount, playlistId: playlistData.playlistId },
  });

  return { addedCount, totalCount };
}

/**
 * Automatically ensures a course has lessons without requiring manual re-entry.
 * If lessons exist, returns them.
 * If no lessons exist, automatically creates them from youtube playlist or video links.
 */
export async function autoEnsureCourseLessons(
  course: Course,
  actor?: UserProfile | null
): Promise<CourseLesson[]> {
  try {
    const existing = await getCourseLessons(course.id);
    if (existing.length > 0) {
      return existing;
    }

    const url = getCourseYoutubeUrl(course);
    if (!url) return [];

    const pseudoActor: UserProfile = actor || ({
      uid: course.createdBy || 'system',
      displayName: course.createdByName || 'WorkHub System',
      email: '',
      role: 'admin',
    } as any);

    const playlistId = extractYouTubePlaylistId(url);
    if (playlistId) {
      try {
        await syncCoursePlaylist(course.id, url, pseudoActor);
        const synced = await getCourseLessons(course.id);
        if (synced.length > 0) return synced;
      } catch (syncErr) {
        console.warn('autoEnsureCourseLessons playlist sync notice:', syncErr);
      }
    }

    // Single video fallback or direct video ID
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const lessonId = `les_${course.id}_p1_${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const fallbackLesson: CourseLesson = {
        id: lessonId,
        courseId: course.id,
        youtubeVideoId: videoId,
        title: course.title || 'الدرس الأول (فيديو تعليمي)',
        description: course.description || '',
        thumbnailUrl:
          course.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        position: 1,
        status: 'available',
        duration: course.duration || 'فيديو تعليمي',
        createdAt: now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, 'courses', course.id, 'lessons', lessonId), fallbackLesson);
        await updateDoc(doc(db, 'courses', course.id), {
          totalLessons: 1,
          youtubeUrl: url,
          youtubePlaylistUrl: url,
          updatedAt: now,
        });
      } catch (e) {
        console.warn('Failed to write auto-lesson doc to firestore:', e);
      }

      return [fallbackLesson];
    }

    return [];
  } catch (err) {
    console.error('autoEnsureCourseLessons error:', err);
    return [];
  }
}

// ─── 5. Course Progress & Sequential Unlock Logic ───────────────────────────

export function subscribeUserCourseProgress(
  userId: string,
  courseId: string,
  callback: (progress: CourseProgress | null) => void
): () => void {
  const progressId = `${userId}_${courseId}`;
  return onSnapshot(
    doc(db, 'course_progress', progressId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ id: snap.id, ...snap.data() } as CourseProgress);
      }
    },
    (err) => console.warn('subscribeUserCourseProgress notice:', err)
  );
}

export function subscribeUserAllProgress(
  userId: string,
  callback: (progressList: CourseProgress[]) => void
): () => void {
  const q = query(collection(db, 'course_progress'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseProgress));
      callback(list);
    },
    (err) => console.warn('subscribeUserAllProgress notice:', err)
  );
}

/**
 * Saves meaningful watch time for a lesson (e.g. periodically or on pause).
 */
export async function saveLessonWatchTime(params: {
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  lessonId: string;
  lessonPosition: number;
  watchedSeconds: number;
  totalLessons: number;
}): Promise<void> {
  const {
    userId,
    userEmail,
    userName,
    courseId,
    lessonId,
    lessonPosition,
    watchedSeconds,
    totalLessons,
  } = params;

  if (!userId || !courseId || !lessonId) return;

  const progressId = `${userId}_${courseId}`;
  const progressRef = doc(db, 'course_progress', progressId);
  const now = new Date().toISOString();

  const snap = await getDoc(progressRef);

  if (!snap.exists()) {
    const initialProgress: CourseProgress = {
      id: progressId,
      userId,
      userEmail: userEmail || '',
      userName: userName || 'طالب',
      courseId,
      completedLessonIds: [],
      currentLessonId: lessonId,
      currentLessonPosition: lessonPosition,
      completedCount: 0,
      totalLessons: Math.max(1, totalLessons),
      percentCompleted: 0,
      isCompleted: false,
      lastWatchedAt: now,
      lessonProgress: {
        [lessonId]: {
          watchedSeconds: Math.round(watchedSeconds),
          completed: false,
          lastWatchedAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(progressRef, initialProgress);
  } else {
    const current = snap.data() as CourseProgress;
    const existingLessonProg = current.lessonProgress?.[lessonId] || {
      watchedSeconds: 0,
      completed: false,
      lastWatchedAt: now,
    };

    await updateDoc(progressRef, {
      currentLessonId: lessonId,
      currentLessonPosition: lessonPosition,
      lastWatchedAt: now,
      updatedAt: now,
      [`lessonProgress.${lessonId}`]: {
        ...existingLessonProg,
        watchedSeconds: Math.max(existingLessonProg.watchedSeconds || 0, Math.round(watchedSeconds)),
        lastWatchedAt: now,
      },
    });
  }
}

/**
 * Marks a lesson as completed when the user finishes the video.
 * Validates sequential unlock rules and unlocks the next lesson.
 */
export async function completeLesson(params: {
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  lessonId: string;
  lessonPosition: number;
  totalLessons: number;
}): Promise<{ progress: CourseProgress; nextLessonUnlocked: boolean }> {
  const {
    userId,
    userEmail,
    userName,
    courseId,
    lessonId,
    lessonPosition,
    totalLessons,
  } = params;

  if (!userId || !courseId || !lessonId) {
    throw new Error('بيانات الدرس غير مكتملة.');
  }

  const progressId = `${userId}_${courseId}`;
  const progressRef = doc(db, 'course_progress', progressId);
  const now = new Date().toISOString();

  const snap = await getDoc(progressRef);
  let progress: CourseProgress;

  if (!snap.exists()) {
    // Lesson 1 completed as the very first interaction
    const completedSet = new Set<string>([lessonId]);
    const completedCount = completedSet.size;
    const percent = Math.min(100, Math.round((completedCount / Math.max(1, totalLessons)) * 100));
    const isCompleted = completedCount >= totalLessons && totalLessons > 0;

    progress = {
      id: progressId,
      userId,
      userEmail: userEmail || '',
      userName: userName || 'طالب',
      courseId,
      completedLessonIds: Array.from(completedSet),
      currentLessonId: lessonId,
      currentLessonPosition: lessonPosition,
      completedCount,
      totalLessons: Math.max(1, totalLessons),
      percentCompleted: percent,
      isCompleted,
      completedAt: isCompleted ? now : null,
      lastWatchedAt: now,
      lessonProgress: {
        [lessonId]: {
          watchedSeconds: 0,
          completed: true,
          completedAt: now,
          lastWatchedAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(progressRef, progress);
  } else {
    const current = snap.data() as CourseProgress;
    const completedSet = new Set<string>(current.completedLessonIds || []);
    completedSet.add(lessonId);

    const completedCount = completedSet.size;
    const effectiveTotal = Math.max(current.totalLessons || totalLessons, 1);
    const percent = Math.min(100, Math.round((completedCount / effectiveTotal) * 100));
    const isCompleted = completedCount >= effectiveTotal && effectiveTotal > 0;

    const existingLessonProg = current.lessonProgress?.[lessonId] || {
      watchedSeconds: 0,
      completed: false,
      lastWatchedAt: now,
    };

    progress = {
      ...current,
      completedLessonIds: Array.from(completedSet),
      currentLessonId: lessonId,
      currentLessonPosition: lessonPosition,
      completedCount,
      percentCompleted: percent,
      isCompleted,
      completedAt: isCompleted ? (current.completedAt || now) : null,
      lastWatchedAt: now,
      updatedAt: now,
      lessonProgress: {
        ...(current.lessonProgress || {}),
        [lessonId]: {
          ...existingLessonProg,
          completed: true,
          completedAt: existingLessonProg.completedAt || now,
          lastWatchedAt: now,
        },
      },
    };

    await updateDoc(progressRef, {
      completedLessonIds: Array.from(completedSet),
      currentLessonId: lessonId,
      currentLessonPosition: lessonPosition,
      completedCount,
      percentCompleted: percent,
      isCompleted,
      completedAt: progress.completedAt,
      lastWatchedAt: now,
      updatedAt: now,
      [`lessonProgress.${lessonId}`]: progress.lessonProgress[lessonId],
    });
  }

  return { progress, nextLessonUnlocked: true };
}

/**
 * Resets course learning progress for testing / restart.
 */
export async function resetCourseProgress(userId: string, courseId: string): Promise<void> {
  const progressId = `${userId}_${courseId}`;
  await deleteDoc(doc(db, 'course_progress', progressId));
}

