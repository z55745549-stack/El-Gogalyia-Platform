/**
 * Standardized Production Error Handling System
 * Ensures internal database errors and stack traces are never leaked to end users.
 * Provides consistent user-friendly Arabic messages and structured debug logs.
 */

export class AppError extends Error {
  public readonly userMessage: string;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(userMessage: string, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true) {
    super(userMessage);
    this.userMessage = userMessage;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'غير مصرح لك بالوصول إلى هذا المورد أو تنفيذ هذا الإجراء.',
  UNAUTHENTICATED: 'يرجى تسجيل الدخول أولاً للمتابعة.',
  NOT_FOUND: 'العنصر المطلوب غير موجود أو تم نقله.',
  FORBIDDEN: 'ليس لديك الصلاحيات الكافية لإتمام هذا الإجراء.',
  VALIDATION_FAILED: 'يرجى التأكد من صحة البيانات المدخلة.',
  RATE_LIMITED: 'تم تجاوز الحد المسموح به من المحاولات. يرجى المحاولة لاحقاً.',
  SESSION_EXPIRED: 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.',
  NETWORK_ERROR: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة ثانية.',
  INSUFFICIENT_FUNDS: 'رصيد O Coins غير كافٍ لإتمام هذه العملية.',
  DUPLICATE_ENTRY: 'هذا السجل مسجل بالفعل في النظام.',
  OPERATION_FAILED: 'حدث خطأ غير متوقع أثناء تنفيذ العملية. يرجى المحاولة مرة أخرى.',
};

export function parseErrorMessage(error: unknown, defaultMessage = ERROR_MESSAGES.OPERATION_FAILED): string {
  if (!error) return defaultMessage;

  if (error instanceof AppError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    const msg = error.message;

    // Map common Firebase and standard error patterns to safe Arabic messages
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED') || msg.includes('Missing or insufficient permissions')) {
      return ERROR_MESSAGES.FORBIDDEN;
    }
    if (msg.includes('unauthenticated') || msg.includes('auth/')) {
      return ERROR_MESSAGES.UNAUTHENTICATED;
    }
    if (msg.includes('not-found') || msg.includes('NOT_FOUND')) {
      return ERROR_MESSAGES.NOT_FOUND;
    }
    if (msg.includes('resource-exhausted') || msg.includes('quota') || msg.includes('rate-limit')) {
      return ERROR_MESSAGES.RATE_LIMITED;
    }
    if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (msg.includes('already-exists') || msg.includes('already recorded')) {
      return ERROR_MESSAGES.DUPLICATE_ENTRY;
    }
    if (msg.includes('رصيد غير كاف') || msg.includes('insufficient')) {
      return ERROR_MESSAGES.INSUFFICIENT_FUNDS;
    }

    // Return message if it's already a safe Arabic string
    if (/[\u0600-\u06FF]/.test(msg)) {
      return msg;
    }
  }

  return defaultMessage;
}

export function logError(context: string, error: unknown, metadata?: Record<string, any>) {
  if (import.meta.env.DEV) {
    console.error(`[AppError: ${context}]`, error, metadata || '');
  }
}
