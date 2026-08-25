#!/usr/bin/env node
/**
 * Seed the default site content into Firestore from the command line.
 *
 * The admin dashboard has a "Seed default content" button that does the same thing, and
 * for most people that is the easier route. This script exists for the case where you
 * want the content in place *before* the first admin can sign in, and for scripted or
 * repeated setup.
 *
 * Safe to run more than once: existing documents are never overwritten. Pass --force to
 * deliberately reset content back to the shipped defaults.
 *
 * Requires ./serviceAccountKey.json — same key as scripts/setup-admin.mjs.
 *
 * Usage:
 *   npm run seed
 *   npm run seed -- --force
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const force = process.argv.includes('--force');

/* ---- credentials ---- */

const keyPath = resolve(projectRoot, 'serviceAccountKey.json');
if (!existsSync(keyPath)) {
  console.error(`
Could not find serviceAccountKey.json.

  Firebase console -> Project settings -> Service accounts -> Generate new private key,
  then save it as serviceAccountKey.json in the project folder.

  Alternatively, sign in to the dashboard and use the "Seed default content" button
  on the Dashboard page — it does the same thing and needs no key.
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/* ---- defaults ----
 * Loaded from the TypeScript source so the script and the app can never disagree about
 * what "the defaults" are. `defaults.ts` is deliberately free of runtime imports beyond
 * types, which is what makes stripping the type annotations enough to run it here.
 */

async function loadDefaults() {
  const source = readFileSync(resolve(projectRoot, 'src/services/defaults.ts'), 'utf8');

  // Strip TypeScript-only syntax: the type-only import, and `: Type` annotations on the
  // exported constants. Everything that remains is plain JavaScript.
  const javascript = source
    .replace(/import type \{[\s\S]*?\} from '@\/types';/g, '')
    .replace(/export const (\w+):\s*[^=]+=/g, 'export const $1 =')
    .replace(/ as Record<[\s\S]*?>;/g, ';')
    .replace(/\)\s*as\s+\w+(\[\])?;/g, ');');

  const dataUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
  return import(dataUrl);
}

/* ---- seeding ---- */

async function seedDocument(path, data, label) {
  const [collection, id] = path.split('/');
  const ref = db.collection(collection).doc(id);
  const snapshot = await ref.get();

  if (snapshot.exists && !force) {
    console.log(`  skipped  ${label} (already exists)`);
    return false;
  }

  await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
  console.log(`  ${snapshot.exists ? 'replaced' : 'created '} ${label}`);
  return true;
}

async function seedSubjects(subjects) {
  const existing = await db.collection('subjects').get();

  if (!existing.empty && !force) {
    console.log(`  skipped  subjects (${existing.size} already present)`);
    return 0;
  }

  const batch = db.batch();
  if (force) {
    for (const doc of existing.docs) batch.delete(doc.ref);
  }
  for (const subject of subjects) {
    const { id, ...rest } = subject;
    batch.set(db.collection('subjects').doc(id), {
      ...rest,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`  created  ${subjects.length} subjects`);
  return subjects.length;
}

async function main() {
  console.log(`\nProject: ${serviceAccount.project_id}`);
  if (force) {
    console.log('Mode:    --force (existing content WILL be overwritten)\n');
  } else {
    console.log('Mode:    safe (existing content is left untouched)\n');
  }

  const defaults = await loadDefaults();

  await seedDocument('settings/site', defaults.DEFAULT_SITE, 'settings/site');
  await seedDocument('settings/scheduling', defaults.DEFAULT_SCHEDULING, 'settings/scheduling');
  await seedDocument('settings/legal', defaults.DEFAULT_LEGAL, 'settings/legal');
  await seedSubjects(defaults.DEFAULT_SUBJECTS);

  console.log(`
Done.

  Next: grant yourself admin access if you have not already —
    npm run setup:admin -- --email you@example.com --create
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\nSeeding failed: ${error.message}\n`);
    process.exit(1);
  });
