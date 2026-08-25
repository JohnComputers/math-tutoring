/**
 * The `subjects` collection — the cards on the "What I Tutor" section.
 *
 * Publicly readable, admin-writable. Ordering is an explicit `order` field rather than
 * creation time so the admin can drag them into any sequence.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Subject } from '@/types';
import { logError } from '@/utils/errors';
import { DEFAULT_SUBJECTS } from './defaults';

const COLLECTION = 'subjects';

function toSubject(id: string, data: Record<string, unknown>): Subject {
  return {
    id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    icon: String(data.icon ?? 'calculator'),
    gradeRange: String(data.gradeRange ?? ''),
    priceLabel: String(data.priceLabel ?? ''),
    order: Number(data.order ?? 0),
    visible: data.visible !== false,
    createdAt: data.createdAt as Subject['createdAt'],
    updatedAt: data.updatedAt as Subject['updatedAt'],
  };
}

/** All subjects, ordered. Admin views need hidden ones too, hence the flag. */
export async function getSubjects(includeHidden = false): Promise<Subject[]> {
  try {
    const snapshot = await getDocs(query(collection(db(), COLLECTION), orderBy('order')));
    const subjects = snapshot.docs.map((d) => toSubject(d.id, d.data()));
    return includeHidden ? subjects : subjects.filter((s) => s.visible);
  } catch (error) {
    logError('subjects.getSubjects', error);
    // Never leave the section empty because of a transient read failure.
    return includeHidden ? [...DEFAULT_SUBJECTS] : DEFAULT_SUBJECTS.filter((s) => s.visible);
  }
}

export async function createSubject(
  subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = doc(collection(db(), COLLECTION));
  await setDoc(ref, {
    ...subject,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSubject(
  id: string,
  patch: Partial<Omit<Subject, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTION, id));
}

/** Persist a new ordering in one batch, so the list never renders half-reordered. */
export async function reorderSubjects(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db());
  orderedIds.forEach((id, index) => {
    batch.update(doc(db(), COLLECTION, id), { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

/** Seed the four starter subjects, but only into an empty collection. */
export async function seedSubjectsIfEmpty(): Promise<number> {
  const snapshot = await getDocs(collection(db(), COLLECTION));
  if (!snapshot.empty) return 0;

  const batch = writeBatch(db());
  for (const subject of DEFAULT_SUBJECTS) {
    const { id, ...rest } = subject;
    batch.set(doc(db(), COLLECTION, id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return DEFAULT_SUBJECTS.length;
}
