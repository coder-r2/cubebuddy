import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore/lite';
import type { Cloud, CloudCollection, CloudDoc, CloudWrite, PulledDocs, SyncCursor } from './cloudTypes';
import { firebaseConfig } from './config';

// Everything that touches the Firebase SDK. This module is loaded on demand (the Account page, or app
// start when this device is signed in), so visitors who never sign in don't download it (D-092).
// Firestore Lite is enough: sync is plain reads and batched writes, and local data lives in IndexedDB.

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' });

export type { User };

export function onUser(listener: (user: User | null) => void) {
  // Finishes a redirect sign-in (the popup fallback); errors surface through the normal sign-in UI.
  getRedirectResult(auth).catch((error: unknown) => console.warn('Redirect sign-in failed', error));
  return onAuthStateChanged(auth, listener);
}

const POPUP_UNAVAILABLE = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, google);
  } catch (error) {
    // Some in-app browsers block popups; the redirect flow is the fallback (D-040).
    if (POPUP_UNAVAILABLE.includes(errorCode(error))) await signInWithRedirect(auth, google);
    else throw error;
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(user);
}

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const signOut = () => firebaseSignOut(auth);

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

/** Reload the user (e.g. after they clicked the verification link) and return the fresh object. */
export async function refreshUser() {
  if (auth.currentUser) await reload(auth.currentUser);
  return auth.currentUser;
}

export const usesPassword = (user: User) => user.providerData.some((p) => p.providerId === 'password');

/** Delete the account: sign in again (Firebase requires a recent sign-in), then cloud data, then the user. */
export async function deleteAccount(password: string | null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (usesPassword(user)) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password ?? ''));
  } else {
    await reauthenticateWithPopup(user, google);
  }
  await cloudFor(user.uid).deleteAll();
  await deleteUser(user);
}

export function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

const COLLECTIONS: CloudCollection[] = ['meta', 'sessions', 'solveChunks'];
const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch

class FirestoreCloud implements Cloud {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
  ) {}

  private col(name: CloudCollection) {
    return collection(this.db, 'users', this.uid, name);
  }

  async pull(since: SyncCursor | null): Promise<PulledDocs> {
    const read = async (name: CloudCollection): Promise<CloudDoc[]> => {
      const q = since
        ? query(this.col(name), where('syncedAt', '>', new Timestamp(since.seconds, since.nanos)))
        : this.col(name);
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => {
        const { syncedAt, ...data } = d.data();
        const at = syncedAt instanceof Timestamp ? syncedAt : new Timestamp(0, 0);
        return { id: d.id, data, syncedAt: { seconds: at.seconds, nanos: at.nanoseconds } };
      });
    };
    const [meta, sessions, solveChunks] = await Promise.all(COLLECTIONS.map(read));
    return { meta: meta!, sessions: sessions!, solveChunks: solveChunks! };
  }

  async push(writes: readonly CloudWrite[]): Promise<void> {
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const write of writes.slice(i, i + BATCH_LIMIT)) {
        const ref = doc(this.col(write.collection), write.id);
        batch.set(ref, { ...write.data, syncedAt: serverTimestamp() }, { merge: write.merge });
      }
      await batch.commit();
    }
  }

  async deleteAll(): Promise<void> {
    const refs = (await Promise.all(COLLECTIONS.map((name) => getDocs(this.col(name))))).flatMap((s) =>
      s.docs.map((d) => d.ref),
    );
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }
}

export const cloudFor = (uid: string): Cloud => new FirestoreCloud(firestore, uid);
