import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const SUPABASE_URL = 'https://zpepnafsfzbqvxnntdoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZXBuYWZzZnpicXZ4bm50ZG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDEyMTYsImV4cCI6MjEwNDk3NzIxNn0.tp6Jtt5An2g3ODqffaICUtii0Ulw1-jSJzG9S5OvqDc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function generateSalt() { return randomBytes(16).toString('hex'); }
function hashPassword(p, s) { return createHash('sha256').update(p + s).digest('hex'); }

const accounts = [
  { id: 'superadmin_gdg_001', username: 'superadmin', display_name: 'مسؤول النظام', email: 'superadmin@gdghitu.com', role: 'superAdmin', password: 'GDG@HITU2026!', permissions: ['tasks.create','tasks.edit','tasks.delete','tasks.assign','tasks.review','tasks.view_all','employees.view','employees.manage','ocoins.manage','ocoins.view_all','reports.view','reports.export','access.manage','activity.view','notifications.send'], status: 'active', ocoins_balance: 5000 },
  { id: 'employee_gdg_001', username: 'employee1', display_name: 'موظف تجريبي', email: 'employee@gdghitu.com', role: 'employee', password: 'Emp@HITU2026!', permissions: [], status: 'active', ocoins_balance: 250 }
];

for (const acc of accounts) {
  const salt = generateSalt();
  const passwordHash = hashPassword(acc.password, salt);
  const { error } = await supabase.from('users').upsert({ id: acc.id, username: acc.username, display_name: acc.display_name, email: acc.email, photo_url: '', role: acc.role, permissions: acc.permissions, status: acc.status, ocoins_balance: acc.ocoins_balance, password_hash: passwordHash, salt: salt, employee_code: acc.role === 'employee' ? 'EMP-001' : null, requires_2fa: false }, { onConflict: 'username' });
  if (error) { console.error('Failed:', acc.username, error.message); } 
  else { console.log('Created:', acc.role, acc.username, '/', acc.password); }
}
