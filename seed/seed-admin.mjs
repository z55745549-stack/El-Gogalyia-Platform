/**
 * Seed Script for GDG HITU Platform (Supabase)
 * 
 * Usage:
 *   node seed/seed-admin.mjs admin@example.com "Admin Name"
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://zpepnafsfzbqvxnntdoe.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_ANON_KEY) {
  console.error("Please set VITE_SUPABASE_ANON_KEY environment variable.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adminEmail = process.argv[2] || "admin@example.com";
const adminName = process.argv[3] || "System Administrator";

async function seedFirstAdmin() {
  console.log(`\n🌱 Bootstrapping initial Admin account in GDG Platform...`);
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Name:  ${adminName}\n`);

  try {
    const { error } = await supabase.from('users').upsert({
      id: `user_${Date.now()}`,
      username: adminEmail.split('@')[0],
      display_name: adminName,
      email: adminEmail.toLowerCase(),
      photo_url: "",
      role: "admin",
      permissions: [
        "tasks.create", "tasks.edit", "tasks.delete", "tasks.assign",
        "tasks.review", "tasks.view_all", "employees.view", "employees.manage",
        "ocoins.manage", "ocoins.view_all", "reports.view", "reports.export",
        "access.manage", "activity.view", "notifications.send"
      ],
      status: "active",
      ocoins_balance: 1000,
    });

    if (error) throw error;
    console.log(`✅ Admin account "${adminEmail}" provisioned successfully in Supabase.`);
  } catch (err) {
    console.error(`❌ Error provisioning admin account:`, err);
  }
}

seedFirstAdmin();
