/**
 * SECURE SUPER ADMIN INITIALIZATION HELPER
 * 
 * Provides a programmatic initialization function for setting up
 * the Super Admin account with PBKDF2 hashing.
 * 
 * Global window injection has been removed for OWASP security compliance.
 */

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { hashPassword, generateSalt } from './auth-security';
import type { UserProfile } from '@/types';

const SUPER_ADMIN_UID = 'user_superadmin';
const SUPER_ADMIN_USERNAME = 'operattionadmin';

export async function initializeSuperAdmin(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 12) {
    throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل.');
  }

  // Check if already exists
  const existing = await getDoc(doc(db, 'users', SUPER_ADMIN_UID));
  if (existing.exists() && existing.data()?.role === 'superAdmin') {
    throw new Error('حساب المشرف العام مهيأ مسبقاً في قاعدة البيانات.');
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(newPassword, salt);

  const superAdminProfile: Omit<UserProfile, 'uid'> & { passwordHash: string; salt: string } = {
    username: SUPER_ADMIN_USERNAME,
    displayName: 'Super Admin',
    email: 'superadmin@saasworkhub.internal',
    photoURL: '',
    role: 'superAdmin',
    status: 'active',
    permissions: [
      'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
      'tasks.review', 'tasks.view_all', 'employees.view', 'employees.manage',
      'ocoins.manage', 'ocoins.view_all', 'reports.view', 'reports.export',
      'access.manage', 'activity.view', 'notifications.send',
    ],
    oCoinsBalance: 0,
    passwordHash,
    salt,
    createdAt: serverTimestamp() as any,
  };

  await setDoc(doc(db, 'users', SUPER_ADMIN_UID), superAdminProfile);
}
