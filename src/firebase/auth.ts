/**
 * Authentication and the admin authorisation check.
 *
 * Being signed in is *not* the same as being an admin. Firebase Authentication will
 * happily issue a token to anyone who can create an account, so "logged in therefore
 * admin" would hand the dashboard to any stranger who signs up. Authorisation is a
 * separate question, answered two ways:
 *
 *   - a document at `admins/{uid}`, which `firestore.rules` checks on every write;
 *   - a custom claim `admin: true` on the token, which `storage.rules` checks — Storage
 *     rules cannot read Firestore, so they need the claim.
 *
 * `scripts/setup-admin.mjs` sets both together. The UI trusts neither on its own: it
 * checks, and a failed check means the dashboard does not render. But the UI check is
 * only there to avoid showing a broken page — the rules are what actually stop anyone.
 */

import {
  type User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { logError } from '@/utils/errors';

export interface AdminIdentity {
  uid: string;
  email: string;
  displayName: string;
}

/** Subscribe to sign-in state. Returns the unsubscribe function. */
export function watchAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), callback);
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth(), email.trim(), password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth());
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email.trim());
}

/**
 * Whether a signed-in user is authorised for the dashboard.
 *
 * Reads `admins/{uid}` rather than trusting the token's claims, because claims only
 * refresh when the token does (up to an hour), and revoking access should take effect
 * promptly. `firestore.rules` restricts this read to the user's own document, so a
 * signed-in stranger learns nothing beyond "no".
 */
export async function isAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const snapshot = await getDoc(doc(db(), 'admins', user.uid));
    return snapshot.exists();
  } catch (error) {
    // A denied read here means "not an admin" — that is exactly what the rules enforce.
    logError('auth.isAdmin', error);
    return false;
  }
}

export function toIdentity(user: User): AdminIdentity {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Admin',
  };
}

/**
 * Create the very first Firebase Auth account, for the bootstrap flow.
 *
 * This only creates an *account*. It grants nothing: the new uid still has to be added
 * to `admins/{uid}` by `scripts/setup-admin.mjs`, which runs with a service-account key
 * that never leaves the owner's machine. Disable email/password sign-up in the Firebase
 * console once the owner's account exists, and this stops being reachable at all.
 */
export async function createAccount(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth(), email.trim(), password);
  return credential.user;
}

/** Force a token refresh so a freshly granted custom claim takes effect immediately. */
export async function refreshClaims(user: User): Promise<void> {
  try {
    await user.getIdToken(true);
  } catch (error) {
    logError('auth.refreshClaims', error);
  }
}
