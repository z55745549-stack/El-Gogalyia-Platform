import { Timestamp } from 'firebase/firestore';

export type CourseStatus = 'draft' | 'published' | 'unpublished' | 'archived';
export type CourseLevel = 'all' | 'beginner' | 'intermediate' | 'advanced';
export type LessonStatus = 'available' | 'unavailable' | 'private';

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  status: 'active' | 'archived';
  courseCount?: number;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CourseLesson {
  id: string;
  courseId: string;
  youtubeVideoId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
  position: number; // 1-based order
  status: LessonStatus;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  youtubeUrl?: string;
  youtubePlaylistUrl?: string;
  youtubePlaylistId?: string;
  thumbnailUrl?: string;
  externalUrl?: string;
  status: CourseStatus;
  level?: CourseLevel;
  duration?: string; // e.g. "4 ساعات" or "12 درس"
  instructor?: string;
  totalLessons?: number;
  lastSyncedAt?: Timestamp | string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface LessonProgressItem {
  watchedSeconds: number;
  completed: boolean;
  completedAt?: string;
  lastWatchedAt: string;
}

export interface CourseProgress {
  id: string; // ${userId}_${courseId}
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  completedLessonIds: string[];
  currentLessonId?: string;
  currentLessonPosition?: number;
  completedCount: number;
  totalLessons: number;
  percentCompleted: number;
  isCompleted: boolean;
  completedAt?: Timestamp | string | null;
  lastWatchedAt: Timestamp | string;
  lessonProgress: Record<string, LessonProgressItem>;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}
