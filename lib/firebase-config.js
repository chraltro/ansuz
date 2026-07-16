/**
 * Firebase configuration for the Ansuz web app.
 *
 * These are the real values for the norron-5cf3c project, not placeholders.
 * Firebase web API keys are public identifiers, not secrets: they only name the
 * project for the client SDK and ship in every web build regardless. Access
 * control comes from Firestore security rules plus the authorized domain list
 * in the Firebase console, so leaking this key does not grant anyone data
 * access. Rotating it is pointless; tighten the rules instead.
 *
 * The rules this app relies on (users can only touch their own document):
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 *
 * To point this at a different project, replace the object below with the config
 * from Project Settings > General > Your apps > SDK setup and configuration, and
 * add the deploy domain under Authentication > Settings > Authorized domains.
 */

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyClwLix-PHVCV9soMjiOzvIhZTYyLrPqYU",
  authDomain: "norron-5cf3c.firebaseapp.com",
  projectId: "norron-5cf3c",
  storageBucket: "norron-5cf3c.firebasestorage.app",
  messagingSenderId: "553127903115",
  appId: "1:553127903115:web:c9f895fec921ed2594f98e"
};

// Encryption key for additional security layer
export const ENCRYPTION_ENABLED = true;
