/**
 * Firebase client SDK — used for Google sign-in.
 * The backend verifies the ID token from here against Firebase Admin.
 */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId,
);

let auth: ReturnType<typeof getAuth> | null = null;

function getFirebaseAuth() {
  if (!firebaseConfigured) return null;
  if (!auth) {
    auth = getAuth(initializeApp(config));
  }
  return auth;
}

export type GoogleResult = { idToken: string; name: string; email: string };

export async function signInWithGoogle(): Promise<GoogleResult> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error("Google sign-in is not configured.");
  }
  let result = await signInWithPopup(authInstance, new GoogleAuthProvider());
  try {
    return await toGoogleResult(result);
  } catch {
    await authInstance.signOut().catch(() => {});
    result = await signInWithPopup(authInstance, new GoogleAuthProvider());
    return await toGoogleResult(result);
  }
}

async function toGoogleResult(result: UserCredential): Promise<GoogleResult> {
  const idToken = await result.user.getIdToken(true);
  return {
    idToken,
    name: result.user.displayName ?? "",
    email: result.user.email ?? "",
  };
}
