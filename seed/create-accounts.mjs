import { createClient } from '@supabase/supabase-js';
import { pbkdf2Sync, randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function generateSalt() {
  return randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return `pbkdf2$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
}

const leadPassword = process.env.SEED_LEAD_PASSWORD;
const memberPassword = process.env.SEED_MEMBER_PASSWORD;

if (!leadPassword || !memberPassword) {
  console.error('Please set SEED_LEAD_PASSWORD and SEED_MEMBER_PASSWORD.');
  process.exit(1);
}

const adminPermissions = [
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'tasks.assign',
  'tasks.review',
  'tasks.view_all',
  'employees.view',
  'employees.manage',
  'ocoins.manage',
  'ocoins.view_all',
  'reports.view',
  'reports.export',
  'access.manage',
  'activity.view',
  'notifications.send',
];

const accounts = [
  {
    id: 'lead_gdg_001',
    username: process.env.SEED_LEAD_USERNAME || 'lead',
    display_name: process.env.SEED_LEAD_NAME || 'مسؤول النظام',
    email: process.env.SEED_LEAD_EMAIL || 'lead@example.com',
    role: 'lead',
    password: leadPassword,
    permissions: adminPermissions,
    status: 'active',
    ocoins_balance: null,
    employee_code: null,
  },
  {
    id: 'member_gdg_001',
    username: process.env.SEED_MEMBER_USERNAME || 'member1',
    display_name: process.env.SEED_MEMBER_NAME || 'عضو تجريبي',
    email: process.env.SEED_MEMBER_EMAIL || 'member@example.com',
    role: 'member',
    password: memberPassword,
    permissions: [],
    status: 'active',
    ocoins_balance: 250,
    employee_code: 'GOGA-33001',
  },
];

for (const acc of accounts) {
  const salt = generateSalt();
  const passwordHash = hashPassword(acc.password, salt);
  const { password: _password, ...safeAccount } = acc;
  const { error } = await supabase.from('users').upsert(
    {
      ...safeAccount,
      username: acc.username.toLowerCase(),
      email: acc.email.toLowerCase(),
      photo_url: '',
      password_hash: passwordHash,
      salt,
      is_two_factor_enabled: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: 'username' }
  );

  if (error) {
    console.error('Failed:', acc.username, error.message);
  } else {
    console.log('Created/updated:', acc.role, acc.username);
  }
}
