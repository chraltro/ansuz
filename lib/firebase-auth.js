/**
 * Firebase Authentication Module
 * Handles Google Sign-In via Firebase and stores encrypted keys in Firestore
 */

import { FIREBASE_CONFIG } from './firebase-config.js';
import { encrypt, decrypt } from './crypto.js';

let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;

/**
 * Initialize Firebase
 */
export async function initFirebase() {
  if (firebaseApp) return;

  try {
    // Dynamically import Firebase SDK
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    // Store imports for later use
    window.__firebaseImports = { GoogleAuthProvider, signInWithPopup, getAuth };

    console.log('✓ Firebase initialized');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw new Error('Failed to initialize Firebase. Check your configuration.');
  }
}

/**
 * Sign in with Google via Firebase
 * @returns {Promise<{userId: string, email: string, name: string}>}
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  try {
    const { GoogleAuthProvider, signInWithPopup } = window.__firebaseImports;
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    currentUser = {
      userId: result.user.uid,
      email: result.user.email,
      name: result.user.displayName,
      firebaseUser: result.user
    };

    console.log('✓ Signed in as:', currentUser.email);
    return currentUser;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw new Error('Google sign-in failed: ' + error.message);
  }
}

/**
 * Get current signed-in user
 * @returns {{userId: string, email: string, name: string}|null}
 */
export function getCurrentUser() {
  if (auth?.currentUser) {
    return {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email,
      name: auth.currentUser.displayName
    };
  }
  return currentUser;
}

/**
 * Save encrypted keys to Firestore
 * @param {Object} keys
 * @param {string} keys.geminiKey
 * @param {string} keys.githubToken
 * @returns {Promise<void>}
 */
export async function saveKeys(keys) {
  if (!auth?.currentUser) {
    throw new Error('Not signed in');
  }

  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // Encrypt keys before storing
    const encryptedData = {
      geminiKey: await encrypt(keys.geminiKey),
      githubToken: keys.githubToken ? await encrypt(keys.githubToken) : null,
      email: auth.currentUser.email,
      updatedAt: new Date().toISOString()
    };

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userDocRef, encryptedData);

    console.log('✓ Keys saved to Firestore');
  } catch (error) {
    console.error('Error saving keys:', error);
    throw new Error('Failed to save keys: ' + error.message);
  }
}

/**
 * Retrieve and decrypt keys from Firestore
 * @returns {Promise<{geminiKey: string, githubToken: string}|null>}
 */
export async function retrieveKeys() {
  if (!auth?.currentUser) {
    throw new Error('Not signed in');
  }

  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.log('No saved keys found');
      return null;
    }

    const data = docSnap.data();

    // Decrypt keys
    const decryptedKeys = {
      geminiKey: data.geminiKey ? await decrypt(data.geminiKey) : null,
      githubToken: data.githubToken ? await decrypt(data.githubToken) : null
    };

    console.log('✓ Keys retrieved from Firestore');
    return decryptedKeys;
  } catch (error) {
    console.error('Error retrieving keys:', error);
    return null;
  }
}

/**
 * Delete keys from Firestore
 * @returns {Promise<void>}
 */
export async function deleteKeys() {
  if (!auth?.currentUser) {
    throw new Error('Not signed in');
  }

  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await deleteDoc(userDocRef);

    console.log('✓ Keys deleted from Firestore');
  } catch (error) {
    console.error('Error deleting keys:', error);
    throw error;
  }
}

/**
 * Sign out
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (!auth) return;

  try {
    const { signOut: firebaseSignOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    await firebaseSignOut(auth);
    currentUser = null;
    console.log('✓ Signed out');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}
