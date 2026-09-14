/**
 * SECURE LEAD INITIALIZATION HELPER
 * 
 * Provides a programmatic initialization function for setting up
 * the LEAD account with PBKDF2 hashing.
 */

import { doc, setDoc, getDoc, serverTimestamp, db } from './supabase';
import { hashPassword, generateSalt } from './auth-security';
import type { UserProfile } from '@/types';

const LEAD_ADMIN_UID = 'user_lead';
const LEAD_ADMIN_USERNAME = 'leadadmin';

export async function initializeLeadAdmin(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 12) {
    throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل.');
  }

  // Check if already exists
  const existing = await getDoc(doc(db, 'users', LEAD_ADMIN_UID));
  if (existing.exists() && (existing.data()?.role === 'lead' || existing.data()?.role === 'head')) {
    throw new Error('حساب قائد المنصة مهيأ مسبقاً في قاعدة البيانات.');
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(newPassword, salt);

  const leadAdminProfile: Omit<UserProfile, 'uid'> & { passwordHash: string; salt: string } = {
    username: LEAD_ADMIN_USERNAME,
    displayName: 'LEAD',
    email: 'lead@gdg-hitu.org',
    photoURL: '',
    role: 'lead',
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

  await setDoc(doc(db, 'users', LEAD_ADMIN_UID), leadAdminProfile);
}


