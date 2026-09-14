/**
 * Seed Script for SAAS Work Hub
 * 
 * Usage:
 *   1. Set your Firebase project config or use Firebase Admin credentials
 *   2. Run: node seed/seed-admin.mjs admin@example.com "Admin Name"
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const adminEmail = process.argv[2] || "admin@example.com";
const adminName = process.argv[3] || "System Administrator";

async function seedFirstAdmin() {
  console.log(`\n🌱 Bootstrapping initial Admin account in SAAS Work Hub...`);
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Name:  ${adminName}\n`);

  try {
    const userRef = doc(db, 'authorizedUsers', adminEmail.toLowerCase());
    await setDoc(userRef, {
      email: adminEmail.toLowerCase(),
      displayName: adminName,
      photoURL: "",
      role: "admin",
      permissions: [
        "tasks.create", "tasks.edit", "tasks.delete", "tasks.assign",
        "tasks.review", "tasks.view_all", "employees.view", "employees.manage",
        "ocoins.manage", "ocoins.view_all", "reports.view", "reports.export",
        "access.manage", "activity.view", "notifications.send"
      ],
      status: "active",
      uid: null,
      createdAt: serverTimestamp(),
      createdBy: "system_bootstrap"
    });

    console.log(`✅ Admin account "${adminEmail}" provisioned successfully in authorizedUsers.`);
    console.log(`👉 You can now sign in with this Google account to access the Admin Dashboard.\n`);
  } catch (err) {
    console.error(`❌ Error provisioning admin account:`, err);
  }
}

seedFirstAdmin();
