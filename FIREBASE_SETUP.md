# Firebase Setup & Deployment Guide — SAAS Work Hub

This document provides step-by-step instructions for configuring a completely fresh **Firebase Project** for SAAS Work Hub, including **Authentication**, **Cloud Firestore Database**, **Firebase Storage**, **Security Rules**, and **Environment Variables**.

---

## Step 1 — Create Firebase Project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project** (or **Add project**).
3. Enter project name: `saas-work-hub`.
4. (Optional) Enable or disable Google Analytics.
5. Click **Create project** and wait for initialization.

---

## Step 2 — Register Web Application

1. In your project overview, click the **Web** icon (`</>`) to add an app.
2. Enter App nickname: `SAAS Work Hub Web App`.
3. Do NOT check Firebase Hosting for now (or enable if deploying to Hosting).
4. Click **Register app**.
5. Copy the `firebaseConfig` object properties for step 3.

---

## Step 3 — Configure Environment Variables

Create `.env.local` in the project root directory with your Firebase Web credentials:

```bash
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

> **Security Note**: Never commit your `.env.local` file or server credentials to public version control.

---

## Step 4 — Enable Firebase Authentication

1. Go to **Build** -> **Authentication** in the Firebase Console.
2. Click **Get Started**.
3. Under **Sign-in method**, select **Google**.
4. Enable Google Sign-in.
5. Set project support email and click **Save**.

---

## Step 5 — Configure Authorized Domains

1. In **Authentication**, click the **Settings** tab.
2. Scroll to **Authorized domains**.
3. Click **Add domain**.
4. Add your production/staging domain (e.g. `localhost`, `192.168.1.3`, `yourdomain.web.app`).

---

## Step 6 — Create Cloud Firestore Database

1. Go to **Build** -> **Firestore Database**.
2. Click **Create database**.
3. Select **Production mode** (rules will be updated in Step 8).
4. Select your preferred Cloud Firestore location (e.g., `us-central` or `europe-west`).
5. Click **Enable**.

---

## Step 7 — Create Required Collections & Indexes

The application automatically provisions documents, but the following collections form the database structure:

```text
users/
  {userId}           -> Profile info (displayName, email, role, oCoinsBalance, status)

authorizedUsers/
  {email}            -> Whitelist records (email, role, status, permissions)

tasks/
  {taskId}           -> Tasks (title, description, priority, deadline, reward, assignedTo)
  /submissions/      -> Submissions subcollection (note, files, status, reviewer)

oCoins/
  {transactionId}   -> Ledger (userEmail, amount, type, reason, taskId)

notifications/
  {notificationId}   -> Notifications (recipientEmail, type, title, message, read)

activityLogs/
  {activityId}       -> Audit logs (actor, action, targetType, targetId, createdAt)
```

### Required Firestore Index (Composite Index for Employee Tasks)
If prompted by Firebase Console when querying assigned tasks:
- **Collection**: `tasks`
- **Fields**:
  - `assignedTo` -> Array-contains
  - `createdAt` -> Descending

---

## Step 8 — Deploy Firestore Security Rules

Copy and deploy the contents of `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    match /authorizedUsers/{email} {
      allow read, write: if isAuthenticated();
    }

    match /users/{userId} {
      allow read, write: if isAuthenticated();
    }

    match /tasks/{taskId} {
      allow read, write: if isAuthenticated();
      match /submissions/{subId} {
        allow read, write: if isAuthenticated();
      }
    }

    match /oCoins/{transactionId} {
      allow read, write: if isAuthenticated();
    }

    match /notifications/{notifId} {
      allow read, write: if isAuthenticated();
    }

    match /activityLogs/{logId} {
      allow read, create: if isAuthenticated();
      allow update, delete: if false;
    }
  }
}
```

---

## Step 9 — Configure Firebase Storage

1. Go to **Build** -> **Storage**.
2. Click **Get Started**.
3. Select **Production mode** (rules will be updated in Step 10).
4. Choose storage location and click **Done**.

---

## Step 10 — Deploy Storage Security Rules

Copy and deploy the contents of `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tasks/{taskId}/submissions/{userId}/{fileName} {
      allow read, write: if request.auth != null;
    }
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Step 11 — Testing & Verification Checklist

- [x] Super Admin login via portal (`OperaTTionAdmin` / `OpPeration2026@gdg`).
- [x] Whitelisted Google login (unauthorized accounts get Access Denied).
- [x] Create employee and verify Firestore write in `authorizedUsers` & `users`.
- [x] Create task and assign to specific employee emails (`assignedTo`).
- [x] Employee logs in and views assigned tasks in `/my-tasks`.
- [x] Upload submission attachment file to Firebase Storage.
- [x] Approve task -> O-Coins credited to balance & logged in `oCoins` collection.
- [x] Page refresh -> all data persists cleanly from Cloud Firestore.
