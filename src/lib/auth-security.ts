/**
 * Cryptographic Password Hashing & Verification Utilities
 * Uses Web Crypto API with PBKDF2-HMAC-SHA256 and cryptographic salts.
 * Backward-compatible with previous single-round SHA-256 hashes during auto-upgrade.
 */

/**
 * Generates a cryptographically strong 16-byte hex salt
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes PBKDF2-HMAC-SHA256 (100,000 iterations) hash of a password string
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBuffer = encoder.encode(salt);

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passKey,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedKey));
  return 'pbkdf2$' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Legacy single-round SHA-256 computation for backward compatibility verification
 */
async function legacySha256(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a candidate password against stored salt and passwordHash
 * Handles both PBKDF2 hashes and auto-detected legacy hashes.
 */
export async function verifyPassword(
  candidatePassword: string,
  salt: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!candidatePassword || !salt || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  // Modern PBKDF2 hash verification
  if (storedHash.startsWith('pbkdf2$')) {
    const computed = await hashPassword(candidatePassword, salt);
    return { valid: computed === storedHash, needsRehash: false };
  }

  // Legacy SHA-256 verification
  const legacyComputed = await legacySha256(candidatePassword, salt);
  if (legacyComputed === storedHash) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}
