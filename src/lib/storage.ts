export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
  path: string;
}

/**
 * Local Task Attachment Helper (Zero Firebase Storage requirement)
 * Converts attached file into metadata/local DataURL so no paid Firebase Storage bucket is needed.
 */
export async function uploadTaskAttachment(
  taskId: string,
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedFile> {
  if (onProgress) onProgress(50);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (onProgress) onProgress(100);
      resolve({
        name: file.name,
        url: typeof reader.result === 'string' ? reader.result : '',
        size: file.size,
        type: file.type,
        path: `local_attachments/${file.name}`,
      });
    };

    // If file is large or binary, convert to Data URL for direct local viewing
    reader.readAsDataURL(file);
  });
}
