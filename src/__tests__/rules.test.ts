/**
 * Firestore security-rules tests, run against the emulator.
 *
 * These are the tests that matter most in this project. Everything else verifies that
 * the app behaves; these verify that the *server* refuses to misbehave even when the
 * client is hostile — which is the only guarantee that survives a static site whose
 * JavaScript anyone can rewrite.
 *
 * Run with:  npm run test:rules
 */

import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

let testEnv: RulesTestEnvironment;

const ADMIN_UID = 'admin-user';
const STRANGER_UID = 'signed-in-stranger';

/** A structurally valid booking, one hour from now. */
function validBooking(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    confirmationCode: 'JW-7K2M9Q',
    parentName: 'Dana Rivera',
    studentName: 'Sam',
    phone: '7865551234',
    email: '',
    subject: '',
    notes: '',
    startAt: Timestamp.fromDate(start),
    endAt: Timestamp.fromDate(end),
    durationMinutes: 60,
    dateKey: '2026-09-02',
    timezone: 'America/New_York',
    status: 'confirmed',
    internalNotes: '',
    lockIds: ['g1000', 'g1001'],
    policyAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed the admin allowlist with rules bypassed — in production only the Admin SDK
  // can write here, which is exactly what this simulates.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins', ADMIN_UID), {
      email: 'owner@example.com',
      displayName: 'Owner',
    });
    await setDoc(doc(db, 'settings', 'site'), { businessName: 'Test Tutoring' });
    await setDoc(doc(db, 'subjects', 'algebra-1'), { name: 'Algebra 1', order: 0, visible: true });
    await setDoc(doc(db, 'exceptions', 'x1'), { date: '2026-09-10', kind: 'blockAll', periods: [] });
  });
});

const anon = () => testEnv.unauthenticatedContext().firestore();
const stranger = () => testEnv.authenticatedContext(STRANGER_UID).firestore();
const admin = () => testEnv.authenticatedContext(ADMIN_UID).firestore();

/* ================================================================== */
/* Public content                                                      */
/* ================================================================== */

describe('public content', () => {
  test('anyone may read site settings', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'settings', 'site')));
  });

  test('anyone may read subjects and exceptions', async () => {
    await assertSucceeds(getDocs(collection(anon(), 'subjects')));
    await assertSucceeds(getDocs(collection(anon(), 'exceptions')));
  });

  test('the public may NOT write site settings', async () => {
    await assertFails(setDoc(doc(anon(), 'settings', 'site'), { businessName: 'Hacked' }));
  });

  test('a signed-in non-admin may NOT write site settings', async () => {
    await assertFails(setDoc(doc(stranger(), 'settings', 'site'), { businessName: 'Hacked' }));
  });

  test('an admin may write site settings', async () => {
    await assertSucceeds(
      setDoc(doc(admin(), 'settings', 'site'), { businessName: 'Renamed' }, { merge: true }),
    );
  });

  test('the public may NOT create or delete subjects', async () => {
    await assertFails(setDoc(doc(anon(), 'subjects', 'evil'), { name: 'Evil', order: 0 }));
    await assertFails(deleteDoc(doc(anon(), 'subjects', 'algebra-1')));
  });

  test('the public may NOT create or delete availability exceptions', async () => {
    // Otherwise anyone could close the tutor's calendar, or open it outside their hours.
    await assertFails(
      setDoc(doc(anon(), 'exceptions', 'evil'), { date: '2026-09-11', kind: 'blockAll', periods: [] }),
    );
    await assertFails(deleteDoc(doc(anon(), 'exceptions', 'x1')));
  });
});

/* ================================================================== */
/* Admin allowlist                                                     */
/* ================================================================== */

describe('admin allowlist', () => {
  test('a user may read their own admin document', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'admins', ADMIN_UID)));
  });

  test('a user may NOT read somebody else\'s admin document', async () => {
    await assertFails(getDoc(doc(stranger(), 'admins', ADMIN_UID)));
  });

  test('nobody may list the admin collection', async () => {
    await assertFails(getDocs(collection(admin(), 'admins')));
  });

  test('a signed-in user may NOT promote themselves to admin', async () => {
    // The whole authorisation model rests on this being impossible from the client.
    await assertFails(
      setDoc(doc(stranger(), 'admins', STRANGER_UID), { email: 'me@example.com' }),
    );
  });

  test('even an existing admin may NOT create another admin from the client', async () => {
    await assertFails(setDoc(doc(admin(), 'admins', 'another-uid'), { email: 'x@y.z' }));
  });
});

/* ================================================================== */
/* Bookings                                                            */
/* ================================================================== */

describe('bookings', () => {
  test('the public may create a well-formed booking', async () => {
    const db = anon();
    await assertSucceeds(
      setDoc(doc(db, 'bookings', 'b1'), {
        ...validBooking(),
      }),
    );
  });

  test('the public may NOT read bookings — no PII leaks', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bookings', 'b1'), validBooking());
    });
    await assertFails(getDoc(doc(anon(), 'bookings', 'b1')));
    await assertFails(getDocs(collection(anon(), 'bookings')));
  });

  test('a signed-in non-admin may NOT read bookings', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bookings', 'b1'), validBooking());
    });
    await assertFails(getDoc(doc(stranger(), 'bookings', 'b1')));
  });

  test('an admin may read bookings', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bookings', 'b1'), validBooking());
    });
    await assertSucceeds(getDoc(doc(admin(), 'bookings', 'b1')));
  });

  test('the public may NOT modify or delete a booking', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bookings', 'b1'), validBooking());
    });
    await assertFails(updateDoc(doc(anon(), 'bookings', 'b1'), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(anon(), 'bookings', 'b1')));
  });

  test('an admin may cancel a booking', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bookings', 'b1'), validBooking());
    });
    await assertSucceeds(updateDoc(doc(admin(), 'bookings', 'b1'), { status: 'cancelled' }));
  });

  /* ---- field validation ---- */

  test('rejects a booking that sets its own internal notes', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b2'), {
        ...validBooking({ internalNotes: 'injected' }),
      }),
    );
  });

  test('rejects a booking that pre-sets a non-confirmed status', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b3'), {
        ...validBooking({ status: 'completed' }),
      }),
    );
  });

  test('rejects a booking with extra unexpected fields', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b4'), {
        ...validBooking(),
        isAdmin: true,
      }),
    );
  });

  test('rejects a booking missing a required field', async () => {
    const booking = validBooking();
    delete (booking as Record<string, unknown>).phone;
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b5'), {
        ...booking,
      }),
    );
  });

  test('rejects a booking whose duration disagrees with its interval', async () => {
    // Otherwise the stored numbers could be made to lie about how long the session is.
    const start = new Date(Date.now() + 3_600_000);
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b6'), {
        ...validBooking({
          startAt: Timestamp.fromDate(start),
          endAt: Timestamp.fromDate(new Date(start.getTime() + 30 * 60_000)),
          durationMinutes: 60,
        }),
      }),
    );
  });

  test('rejects a booking in the past', async () => {
    const start = new Date(Date.now() - 86_400_000);
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b7'), {
        ...validBooking({
          startAt: Timestamp.fromDate(start),
          endAt: Timestamp.fromDate(new Date(start.getTime() + 3_600_000)),
        }),
      }),
    );
  });

  test('rejects a booking absurdly far in the future', async () => {
    const start = new Date(Date.now() + 500 * 86_400_000);
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b8'), {
        ...validBooking({
          startAt: Timestamp.fromDate(start),
          endAt: Timestamp.fromDate(new Date(start.getTime() + 3_600_000)),
        }),
      }),
    );
  });

  test('rejects an over-long notes field', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b9'), {
        ...validBooking({ notes: 'x'.repeat(801) }),
      }),
    );
  });

  test('rejects an empty parent name', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b10'), {
        ...validBooking({ parentName: '' }),
      }),
    );
  });

  test('rejects a malformed dateKey', async () => {
    await assertFails(
      setDoc(doc(anon(), 'bookings', 'b11'), {
        ...validBooking({ dateKey: 'tomorrow' }),
      }),
    );
  });
});

/* ================================================================== */
/* Slot locks — the double-booking guarantee                           */
/* ================================================================== */

describe('slot locks', () => {
  const lock = (grain: number) => ({
    grain,
    bookingId: 'b1',
    createdAt: serverTimestamp(),
  });

  test('anyone may read locks — the calendar needs them and they hold no PII', async () => {
    await assertSucceeds(
      getDocs(query(collection(anon(), 'slotLocks'), where('grain', '>=', 0))),
    );
  });

  test('the public may create a lock', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'slotLocks', 'g5000'), lock(5000)));
  });

  test('THE CORE GUARANTEE: the public may NOT overwrite an existing lock', async () => {
    // In Firestore a set() onto an existing document is an *update*. Denying update is
    // what makes double-booking impossible even for a client that skips the transaction.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'slotLocks', 'g5000'), lock(5000));
    });
    await assertFails(
      setDoc(doc(anon(), 'slotLocks', 'g5000'), { ...lock(5000), bookingId: 'attacker' }),
    );
    await assertFails(updateDoc(doc(anon(), 'slotLocks', 'g5000'), { bookingId: 'attacker' }));
  });

  test('the public may NOT delete a lock — no stealing someone else\'s slot', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'slotLocks', 'g5000'), lock(5000));
    });
    await assertFails(deleteDoc(doc(anon(), 'slotLocks', 'g5000')));
  });

  test('an admin may delete a lock (that is how cancellation frees the time)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'slotLocks', 'g5000'), lock(5000));
    });
    await assertSucceeds(deleteDoc(doc(admin(), 'slotLocks', 'g5000')));
  });

  test('rejects a lock whose document id disagrees with its grain field', async () => {
    // A mismatched pair would poison the range query the public calendar depends on.
    await assertFails(setDoc(doc(anon(), 'slotLocks', 'g5000'), lock(9999)));
  });

  test('rejects a lock with a malformed document id', async () => {
    await assertFails(setDoc(doc(anon(), 'slotLocks', 'not-a-grain'), lock(5000)));
  });

  test('rejects a lock with extra fields', async () => {
    await assertFails(
      setDoc(doc(anon(), 'slotLocks', 'g5001'), { ...lock(5001), evil: true }),
    );
  });

  test('rejects a lock with no bookingId', async () => {
    await assertFails(
      setDoc(doc(anon(), 'slotLocks', 'g5002'), { grain: 5002, createdAt: serverTimestamp() }),
    );
  });
});

/* ================================================================== */
/* Default deny                                                        */
/* ================================================================== */

describe('default deny', () => {
  test('an unlisted collection is denied to everyone', async () => {
    await assertFails(getDoc(doc(anon(), 'secrets', 'x')));
    await assertFails(setDoc(doc(anon(), 'secrets', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(admin(), 'secrets', 'x'), { a: 1 }));
  });
});
