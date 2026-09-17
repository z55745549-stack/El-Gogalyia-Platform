/**
 * Seed Script for GDG HITU Platform (Supabase)
 *
 * Usage:
 *   SEED_ADMIN_PASSWORD="..." node seed/seed-admin.mjs admin@example.com "Admin Name"
 */

import { createClient } from '@supabase/supabase-js';
import { pbkdf2Sync, randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  console.error('Please set SEED_ADMIN_PASSWORD.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminEmail = (process.argv[2] || 'admin@example.com').toLowerCase();
const adminName = process.argv[3] || 'System Administrator';

function generateSalt() {
  return randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return `pbkdf2$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
}

async function seedFirstAdmin() {
  console.log('\nBootstrapping initial LEAD account in GDG Platform...');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Name:  ${adminName}\n`);

  const salt = generateSalt();
  const passwordHash = hashPassword(process.env.SEED_ADMIN_PASSWORD, salt);

  try {
    const { error } = await supabase.from('users').upsert({
      id: `lead_${Date.now()}`,
      username: adminEmail.split('@')[0],
      display_name: adminName,
      email: adminEmail,
      photo_url: '',
      role: 'lead',
      permissions: [
        'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
        'tasks.review', 'tasks.view_all', 'employees.view', 'employees.manage',
        'ocoins.manage', 'ocoins.view_all', 'reports.view', 'reports.export',
        'access.manage', 'activity.view', 'notifications.send',
      ],
      status: 'active',
      ocoins_balance: null,
      password_hash: passwordHash,
      salt,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'username' });

    if (error) throw error;
    console.log(`LEAD account "${adminEmail}" provisioned successfully in Supabase.`);
  } catch (err) {
    console.error('Error provisioning LEAD account:', err);
  }
}

seedFirstAdmin();
