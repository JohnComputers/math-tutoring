/**
 * Read/write access to the three settings documents.
 *
 *   settings/site        public marketing copy, theme, SEO
 *   settings/scheduling  availability rules the booking engine runs on
 *   settings/legal       policy documents
 *
 * All three are world-readable (the public site renders them) and admin-writable only.
 * See `firestore.rules`.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { LegalSettings, SchedulingSettings, SiteSettings } from '@/types';
import { deepMerge } from '@/utils/merge';
import { logError } from '@/utils/errors';
import { DEFAULT_LEGAL, DEFAULT_SCHEDULING, DEFAULT_SITE } from './defaults';

const SETTINGS = 'settings';

async function readSettings<T>(id: string, fallback: T, context: string): Promise<T> {
  try {
    const snapshot = await getDoc(doc(db(), SETTINGS, id));
    if (!snapshot.exists()) return fallback;
    return deepMerge(fallback, snapshot.data());
  } catch (error) {
    // A settings read failing must never blank the marketing site. Fall back to the
    // seeded defaults and surface the cause in the console.
    logError(context, error);
    return fallback;
  }
}

export function getSiteSettings(): Promise<SiteSettings> {
  return readSettings('site', DEFAULT_SITE, 'settings.getSiteSettings');
}

export function getSchedulingSettings(): Promise<SchedulingSettings> {
  return readSettings('scheduling', DEFAULT_SCHEDULING, 'settings.getSchedulingSettings');
}

export function getLegalSettings(): Promise<LegalSettings> {
  return readSettings('legal', DEFAULT_LEGAL, 'settings.getLegalSettings');
}

/**
 * Partial update of the site document. `merge: true` means a form that only edits the
 * hero cannot wipe the pricing section by omitting it.
 */
export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<void> {
  await setDoc(
    doc(db(), SETTINGS, 'site'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateSchedulingSettings(
  patch: Partial<SchedulingSettings>,
): Promise<void> {
  await setDoc(
    doc(db(), SETTINGS, 'scheduling'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateLegalSettings(patch: Partial<LegalSettings>): Promise<void> {
  await setDoc(
    doc(db(), SETTINGS, 'legal'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Write the defaults for any settings document that does not exist yet.
 *
 * Called once from the admin dashboard ("Seed default content") rather than on page load:
 * public visitors have no write permission, and an automatic seed would fire a denied
 * write on every visit.
 *
 * Existing documents are left alone, so this is safe to run twice.
 */
export async function seedSettingsIfMissing(): Promise<string[]> {
  const seeded: string[] = [];
  const targets = [
    { id: 'site', value: DEFAULT_SITE },
    { id: 'scheduling', value: DEFAULT_SCHEDULING },
    { id: 'legal', value: DEFAULT_LEGAL },
  ] as const;

  for (const target of targets) {
    const ref = doc(db(), SETTINGS, target.id);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      await setDoc(ref, { ...target.value, updatedAt: serverTimestamp() });
      seeded.push(target.id);
    }
  }
  return seeded;
}
