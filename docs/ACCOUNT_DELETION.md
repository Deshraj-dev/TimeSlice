# TimeSlice — Account and Data Deletion Policy & Instructions

**Application:** TimeSlice  
**Developer:** Deshraj  
**Support Contact:** [deshrajstack@gmail.com](mailto:deshrajstack@gmail.com)  
**Effective Date:** September 17, 2026  
**Last Updated:** September 17, 2026  

---

## 1. Overview

In accordance with Google Play developer policies and international data privacy regulations, TimeSlice provides all users with the ability to permanently delete their account and all associated personal and productivity data.

You can delete your account at any time:
1. **Directly within the TimeSlice app** (instant, automated self-service), OR
2. **Via email request to the developer without needing the app installed** (if you have uninstalled the app or lost access to your device).

---

## 2. What Data Is Deleted When You Delete Your Account

When your TimeSlice account deletion is executed, **all data associated with your user account is permanently deleted from our active database servers**. Specifically, this includes:

* **Authentication & Identity Data:** Your registered email address, encrypted authentication records, and unique Firebase Authentication UID (`request.auth.uid`).
* **Profile Information:** Your display name, account configuration, and Base64-encoded avatar image (`users/{userId}.avatarBase64`). *(Note: TimeSlice does not use or provision Firebase Cloud Storage; all avatar data is stored directly in your user document and deleted with it)*.
* **Productivity & Activity Records:** Every scheduled activity, category, scheduled date, start/end time, duration, color tag, and completion status stored in your private subcollection (`users/{userId}/activities`).
* **Focus Timer Sessions:** Every recorded focus session, duration, timestamp, timer mode, and completed milestone stored in your private subcollection (`users/{userId}/focusSessions`).
* **User Preferences:** Daily focus target hours, notification toggles, reminder lead times, and alert sound/vibration preferences stored in your user document (`users/{userId}`).
* **Push Notification Device Tokens:** Your Firebase Cloud Messaging (FCM) registration token (`users/{userId}.fcmToken`) is invalidated and deleted.
* **Local Device Storage:** If deleted via the app, the local focus timer session state stored on the device (`focus_session_state` in AsyncStorage) is purged immediately.

---

## 3. Data Retention Limitations & Policy

* **Application-Level Deletion:** Account deletion is permanent and irreversible. When deletion is executed, TimeSlice immediately removes your account credentials, user document, activity records, and focus sessions from Google Firebase Authentication and Google Cloud Firestore. TimeSlice does not maintain application-level shadow profiles, recovery archives, or separate retention databases.
* **Third-Party Infrastructure Retention & Backups:** Routine disaster-recovery backups, snapshots, or system logs maintained by Google Cloud / Firebase may retain residual copies of deleted data for a temporary period in accordance with Google's standard cloud data retention and disposal schedules (typically up to 30 to 60 days before hardware-level overwriting). This infrastructure retention is governed directly by Google Cloud's data processing terms, over which TimeSlice has no direct operational control.
* **Local App Storage (Uninstall):** If you delete your account externally via email without opening the app, simply uninstalling the app from your device will clear any residual local device cache.

---

## 4. How to Delete Your Account

### Option 1: In-App Self-Service Deletion (Instant & Automated)
If you currently have the TimeSlice app installed on your device:

1. Open **TimeSlice**.
2. Tap the **Profile** tab in the bottom navigation bar.
3. Scroll down to the **Account & Privacy** section.
4. Tap **Delete Account**.
5. A confirmation dialog will explain that this action is permanent. Tap **Delete My Account**.
6. If your login session requires re-authentication, enter your current password and tap **Confirm & Delete**.
7. Your account and all associated records in Google Firebase and Firestore are immediately and permanently deleted, your local storage is wiped, your FCM token is invalidated, and you will be returned to the login screen.

---

### Option 2: External Deletion Request (Without Needing the App)
If you have uninstalled TimeSlice, lost access to your device, or prefer to request deletion via email:

1. Open your email client.
2. Compose a new email to:  
   **To:** [deshrajstack@gmail.com](mailto:deshrajstack@gmail.com)
3. Use the exact subject line:  
   **Subject:** `TimeSlice Account Deletion Request`
4. **Send from your registered account email:** For security and to verify ownership of the account, please send this request from the email address associated with your TimeSlice account.
5. In the body of the message, state:
   ```text
   Please permanently delete my TimeSlice account and all associated data.
   Registered Email: [your registered email address]
   ```
6. **Processing Timeline & Procedure:**
   * **Manual Review:** Email deletion requests are reviewed and processed manually by the developer (they are not processed automatically by the mobile app).
   * **Verification:** The developer verifies that the sender address matches the registered account email.
   * **Execution:** Once verified, the developer manually executes full deletion of the Firebase Authentication user account and all associated Cloud Firestore documents and subcollections within **30 days** (and typically within **48 to 72 hours**).
   * **Confirmation:** You will receive a written confirmation email once the deletion process is complete.

---

## 5. Questions or Assistance

If you have any questions regarding your personal data or need assistance with the account deletion process, please contact:

**Developer:** Deshraj  
**Email:** [deshrajstack@gmail.com](mailto:deshrajstack@gmail.com)  
**Privacy Policy:** [TimeSlice Privacy Policy](PRIVACY_POLICY.md)  
