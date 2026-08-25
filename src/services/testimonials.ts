/**
 * The `testimonials` collection.
 *
 * Empty by default — an MVP with invented testimonials would be a lie, and the section
 * simply does not render when there is nothing visible in it.
 *
 * Privacy note enforced by convention and by the admin UI's helper text: `author` is a
 * display name ("A parent in Miami"), never a student's full name. See the Privacy Policy.
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
import type { Testimonial } from '@/types';
import { logError } from '@/utils/errors';

const COLLECTION = 'testimonials';

function toTestimonial(id: string, data: Record<string, unknown>): Testimonial {
  return {
    id,
    author: String(data.author ?? ''),
    relationship: String(data.relationship ?? ''),
    quote: String(data.quote ?? ''),
    rating: Number(data.rating ?? 0),
    order: Number(data.order ?? 0),
    visible: data.visible !== false,
    createdAt: data.createdAt as Testimonial['createdAt'],
  };
}

export async function getTestimonials(includeHidden = false): Promise<Testimonial[]> {
  try {
    const snapshot = await getDocs(query(collection(db(), COLLECTION), orderBy('order')));
    const items = snapshot.docs.map((d) => toTestimonial(d.id, d.data()));
    return includeHidden ? items : items.filter((t) => t.visible);
  } catch (error) {
    logError('testimonials.getTestimonials', error);
    return [];
  }
}

export async function createTestimonial(
  testimonial: Omit<Testimonial, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = doc(collection(db(), COLLECTION));
  await setDoc(ref, { ...testimonial, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateTestimonial(
  id: string,
  patch: Partial<Omit<Testimonial, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, id), patch);
}

export async function deleteTestimonial(id: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTION, id));
}

export async function reorderTestimonials(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db());
  orderedIds.forEach((id, index) => {
    batch.update(doc(db(), COLLECTION, id), { order: index });
  });
  await batch.commit();
}
