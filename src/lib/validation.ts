/**
 * Input validation & sanitization using Zod
 * Prevents NoSQL injection, XSS, and malformed data
 */
import { z } from 'zod';

// Ban creation validation - strict, rejects unexpected fields
export const createBanSchema = z.object({
  employeeId: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid ID format'),
  startAt: z.string().or(z.date()).transform(v => new Date(v as any)),
  endAt: z.string().or(z.date()).transform(v => new Date(v as any)),
  reason: z.string().min(5).max(500).trim(),
  internalNote: z.string().max(1000).trim().optional(),
  durationPreset: z.enum(['1','3','7','14','30','custom']).optional(),
}).strict().refine(data => {
  const end = new Date(data.endAt as any);
  const start = new Date(data.startAt as any);
  return end.getTime() > start.getTime();
}, { message: 'End must be after start', path: ['endAt'] });

// Committee validation
export const createCommitteeSchema = z.object({
  name: z.string().min(2).max(50).trim().regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid name'),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color').optional(),
}).strict();

// Meeting validation
export const createMeetingSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  date: z.string().or(z.date()),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time'),
  durationMinutes: z.number().int().min(15).max(480),
  location: z.string().min(3).max(200).trim(),
  type: z.enum(['general','committee','training','review']),
  status: z.enum(['scheduled','in_progress','completed','cancelled']).optional(),
}).strict();

// Query param validation for bans
export const banQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['active','expired','ended_early']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

// Sanitize string to prevent XSS/NoSQL injection
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove NoSQL operators
  let sanitized = input.replace(/\$where|\$eval|\$gt|\$lt|\$ne|\$in|\$regex/gi, '');
  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 1000);
  return sanitized;
}

export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const issues = (e as any).errors ?? (e as any).issues ?? [];
      return { success: false, error: issues.map((err: any) => `${err.path?.join('.')}: ${err.message}`).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}
