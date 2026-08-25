#!/usr/bin/env node
/**
 * Grant admin access to a Firebase Authentication account.
 *
 * ## Why this is a script and not a button
 *
 * Admin access cannot be granted from inside the web app — that is the point. If the
 * dashboard could promote an account, anyone who signed up could promote themselves, and
 * "is an admin" would mean nothing. So the grant happens here, on your machine, using a
 * service-account key that never reaches the browser or the repository.
 *
 * The script writes two things, and both matter:
 *
 *   1. `admins/{uid}` in Firestore — what `firestore.rules` checks on every request.
 *      Reading a document is instant, so revoking access takes effect immediately.
 *
 *   2. A custom auth claim `admin: true` — what `storage.rules` checks, because Storage
 *      rules cannot read Firestore. Claims live in the ID token and refresh at most
 *      hourly, so this one lags; that is why Firestore uses the document instead.
 *
 * ## Usage
 *
 *   1. In the Firebase console: Project settings -> Service accounts -> Generate new
 *      private key. Save it in this folder as `serviceAccountKey.json`.
 *      It is already gitignored. It grants FULL access to your project and bypasses
 *      every security rule — treat it like a password and delete it when you are done.
 *
 *   2. Create the account you want to make an admin, either in the Firebase console
 *      (Authentication -> Users -> Add user) or by passing --create below.
 *
 *   3. Run one of:
 *        npm run setup:admin -- --email you@example.com
 *        npm run setup:admin -- --email you@example.com --create --password 'a-strong-one'
 *        npm run setup:admin -- --list
 *        npm run setup:admin -- --email you@example.com --revoke
 */

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { email: '', password: '', create: false, revoke: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email') args.email = argv[++i] ?? '';
    else if (arg === '--password') args.password = argv[++i] ?? '';
    else if (arg === '--create') args.create = true;
    else if (arg === '--revoke') args.revoke = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
Grant or revoke admin access for the tutoring site.

  --email <address>     the account to act on
  --create              create the account first (requires --password)
  --password <value>    password for --create; prompted for if omitted
  --revoke              remove admin access instead of granting it
  --list                show all current admins
  --help                this message

Requires ./serviceAccountKey.json — see the README, "Creating the first admin".
`);
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

const keyPath = resolve(projectRoot, 'serviceAccountKey.json');

if (!existsSync(keyPath)) {
  console.error(`
Could not find a service account key.

  Expected at: ${keyPath}

  1. Open the Firebase console for your project
  2. Project settings -> Service accounts -> Generate new private key
  3. Save the downloaded file as serviceAccountKey.json in the project folder

That file grants full access to your Firebase project and bypasses all security
rules. It is gitignored, but never share it, and delete it once you are finished.
`);
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (error) {
  console.error(`serviceAccountKey.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (!serviceAccount.project_id || !serviceAccount.private_key) {
  console.error(
    'serviceAccountKey.json does not look like a Firebase service account key ' +
      '(missing project_id or private_key).',
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();
const db = getFirestore();

console.log(`Project: ${serviceAccount.project_id}\n`);

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function listAdmins() {
  const snapshot = await db.collection('admins').get();
  if (snapshot.empty) {
    console.log('No admins yet. Grant the first one with:');
    console.log('  npm run setup:admin -- --email you@example.com --create\n');
    return;
  }
  console.log(`${snapshot.size} admin${snapshot.size === 1 ? '' : 's'}:\n`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`  ${data.email ?? '(unknown email)'}`);
    console.log(`    uid: ${doc.id}`);
  }
  console.log('');
}

async function prompt(question, { silent = false } = {}) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (!silent) {
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  // Suppress echo for passwords. `terminal: true` above makes this reliable.
  stdout.write(question);
  const originalWrite = stdout.write.bind(stdout);
  stdout.write = () => true;
  const answer = await rl.question('');
  stdout.write = originalWrite;
  rl.close();
  stdout.write('\n');
  return answer.trim();
}

async function findOrCreateUser(email, { create, password }) {
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`Found existing account: ${user.uid}`);
    return user;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;

    if (!create) {
      console.error(`
No account exists for ${email}.

Either create it in the Firebase console (Authentication -> Users -> Add user),
or re-run with --create:

  npm run setup:admin -- --email ${email} --create
`);
      process.exit(1);
    }

    let chosen = password;
    if (!chosen) {
      chosen = await prompt('Choose a password (at least 12 characters): ', { silent: true });
    }
    if (!chosen || chosen.length < 12) {
      console.error(
        '\nPassword must be at least 12 characters. This account can read every ' +
          "booking you have, including students' names and parents' phone numbers.",
      );
      process.exit(1);
    }

    const user = await auth.createUser({ email, password: chosen, emailVerified: false });
    console.log(`Created account: ${user.uid}`);
    return user;
  }
}

async function grant(email, options) {
  const user = await findOrCreateUser(email, options);

  // 1. Firestore document — checked by firestore.rules on every request.
  await db.collection('admins').doc(user.uid).set(
    {
      email: user.email ?? email,
      displayName: user.displayName ?? email.split('@')[0],
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log('Added to the admins collection.');

  // 2. Custom claim — checked by storage.rules, which cannot read Firestore.
  const existingClaims = user.customClaims ?? {};
  await auth.setCustomUserClaims(user.uid, { ...existingClaims, admin: true });
  console.log('Set the admin custom claim (needed for photo uploads).');

  console.log(`
Done. ${email} can now sign in at /#/admin.

  If they are already signed in somewhere, the photo upload permission arrives
  when their token next refreshes — signing out and back in makes it immediate.
`);
}

async function revoke(email) {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  await db.collection('admins').doc(user.uid).delete();
  console.log('Removed from the admins collection — dashboard access is revoked now.');

  const existingClaims = { ...(user.customClaims ?? {}) };
  delete existingClaims.admin;
  await auth.setCustomUserClaims(user.uid, existingClaims);
  console.log('Removed the admin custom claim.');

  // Claims live in the ID token for up to an hour. Revoking refresh tokens forces a
  // fresh sign-in, so Storage access stops promptly rather than at token expiry.
  await auth.revokeRefreshTokens(user.uid);
  console.log('Revoked existing sessions.');

  console.log(`\nDone. ${email} no longer has admin access.\n`);
}

/* ------------------------------------------------------------------ */

async function main() {
  if (args.list) {
    await listAdmins();
    return;
  }

  let email = args.email;
  if (!email) {
    email = await prompt('Email address of the admin account: ');
  }
  if (!email || !email.includes('@')) {
    console.error('A valid email address is required.');
    process.exit(1);
  }

  if (args.revoke) await revoke(email);
  else await grant(email, { create: args.create, password: args.password });

  await listAdmins();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nSomething went wrong:\n');
    console.error(`  ${error.code ? `${error.code}: ` : ''}${error.message}`);
    if (error.code === 'app/invalid-credential') {
      console.error(
        '\n  The service account key looks invalid or belongs to a different project.',
      );
    }
    console.error('');
    process.exit(1);
  });
