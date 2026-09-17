import { supabase } from './supabase';

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
  path: string;
}

/**
 * Upload attachment to Supabase Storage bucket 'attachments'
 * Fallback to local DataURL if Supabase storage upload encounters issues.
 */
export async function uploadTaskAttachment(
  taskId: string,
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedFile> {
  if (onProgress) onProgress(30);

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `tasks/${taskId}/${Date.now()}_${userId}_${cleanName}`;

  try {
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (onProgress) onProgress(80);

    if (!error && data) {
      const { data: pubUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(data.path);

      if (onProgress) onProgress(100);
      return {
        name: file.name,
        url: pubUrlData.publicUrl,
        size: file.size,
        type: file.type,
        path: data.path,
      };
    }
  } catch (err) {
    console.warn('Supabase storage notice, falling back to local data:', err);
  }

  // Fallback to Data URL only for small files (<500KB) to prevent QuotaExceededError in localStorage
  if (file.size > 500 * 1024) {
    throw new Error(
      'تعذر رفع الملف إلى مساحة التخزين السحابية (Supabase Storage). يرجى التأكد من إعداد الـ Bucket المسمى "attachments" في لوحة تحكم Supabase.'
    );
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (onProgress) onProgress(100);
      resolve({
        name: file.name,
        url: typeof reader.result === 'string' ? reader.result : '',
        size: file.size,
        type: file.type,
        path: filePath,
      });
    };
    reader.readAsDataURL(file);
  });
}
