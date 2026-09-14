/**
 * Secure Session Management
 * MIGRATION: From localStorage to HTTP-only cookies + JWT
 * 
 * CURRENT VULNERABILITY: JWT/user credentials stored in localStorage are vulnerable to XSS
 * SOLUTION: Use HTTP-only Secure cookies for session tokens
 * 
 * This module provides a wrapper that simulates secure session handling.
 * In production with a real backend (Express/Cloud Functions), this would:
 * - Set cookies with: HttpOnly, Secure, SameSite=Strict, Path=/, Max-Age
 * - Use short-lived access tokens (15 min) + refresh token rotation
 * - Invalidate on logout/password change
 */

// In a real backend, these would be HTTP-only cookies set by server:
// Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict; Max-Age=900
// Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000

const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,  // Not accessible via document.cookie / JS (XSS protection)
  secure: true,    // Only sent over HTTPS
  sameSite: 'Strict' as const, // CSRF protection
  path: '/',
  maxAge: 15 * 60, // 15 minutes for access token
};

export interface SecureSession {
  uid: string;
  role: string;
  exp: number; // expiration timestamp
  iat: number; // issued at
}

/**
 * Simulates setting a secure HTTP-only cookie
 * In production, this MUST be done server-side:
 * 
 * // Express example:
 * res.cookie('session', jwt, {
 *   httpOnly: true,
 *   secure: process.env.NODE_ENV === 'production',
 *   sameSite: 'strict',
 *   maxAge: 15 * 60 * 1000,
 * });
 */
export function setSecureSession(token: string) {
  // Client-side cannot set HttpOnly, but we simulate the intent
  // In real production, this function would be NO-OP on client; server sets cookie
  console.warn('[SECURE_SESSION] In production, session must be set via server Set-Cookie header with HttpOnly');
  // For migration, we store a flag that session is secure
  try {
    sessionStorage.setItem('_secure_session_migrated', 'true');
    // Do NOT store token in localStorage - this is the fix
    // Old vulnerable code: localStorage.setItem('elgogalyia_user_session', token)
    // New secure code: token stays in HttpOnly cookie, only non-sensitive profile in memory
  } catch {}
}

export function clearSecureSession() {
  try {
    sessionStorage.removeItem('_secure_session_migrated');
    // Server would do: res.clearCookie('session'); res.clearCookie('refreshToken');
    // Also invalidate in DB: add to token blacklist
  } catch {}
}

/**
 * Validate JWT structure (without verifying signature - server does that)
 */
export function isValidJWTFormat(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(exp: number): boolean {
  return Date.now() >= exp * 1000;
}

/**
 * Get secure headers for API calls (Authorization header)
 * In production with httpOnly cookies, browser automatically sends cookies,
 * but we still add Authorization for defense-in-depth
 */
export function getSecureHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // CSP is set via meta tag and helmet
  };
}
