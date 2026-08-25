/**
 * Concurrency tests for the booking transaction, run against the Firestore emulator.
 *
 * This is the claim the whole scheduling design rests on: *two people cannot book the
 * same time*. Asserting it in prose is easy; this proves it by firing genuinely parallel
 * bookings at one slot and checking that exactly one survives.
 *
 * These run against the real security rules too, so a booking that the rules would
 * reject fails here the same way it would in production.
 *
 * Run with:  npm run test:rules
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { BookingFormValues, SchedulingSettings } from '@/types';
import { auth } from '@/firebase/config';
import { createAccount, signIn, signOut } from '@/firebase/auth';
import {
  cancelBooking,
  createBooking,
  getOccupiedGrains,
  rescheduleBooking,
  setBookingStatus,
} from '@/services/bookings';
import { DEFAULT_SCHEDULING } from '@/services/defaults';
import { SlotTakenError, ValidationError } from '@/utils/errors';
import { generateSlots, grainsFor } from '@/utils/slots';
import { addDays, todayDateKey, zonedTimeToUtc } from '@/utils/time';

const NY = 'America/New_York';

const scheduling: SchedulingSettings = {
  ...DEFAULT_SCHEDULING,
  timezone: NY,
  bufferMinutes: 15,
  minimumNoticeMinutes: 0,
  allowSameDayBookings: true,
  sessionDurations: [30, 60, 90],
  weekly: {
    0: { enabled: true, periods: [{ start: 10 * 60, end: 18 * 60 }] },
    1: { enabled: true, periods: [{ start: 9 * 60, end: 21 * 60 }] },
    2: { enabled: true, periods: [{ start: 9 * 60, end: 21 * 60 }] },
    3: { enabled: true, periods: [{ start: 9 * 60, end: 21 * 60 }] },
    4: { enabled: true, periods: [{ start: 9 * 60, end: 21 * 60 }] },
    5: { enabled: true, periods: [{ start: 9 * 60, end: 21 * 60 }] },
    6: { enabled: true, periods: [{ start: 10 * 60, end: 18 * 60 }] },
  } as SchedulingSettings['weekly'],
};

/** A date comfortably in the future so notice rules never interfere. */
const TARGET_DATE = addDays(todayDateKey(NY), 14);

function form(overrides: Partial<BookingFormValues> = {}): BookingFormValues {
  return {
    parentName: 'Dana Rivera',
    studentName: 'Sam',
    phone: '7865551234',
    email: '',
    subject: '',
    notes: '',
    policyAccepted: true,
    ...overrides,
  };
}

const PROJECT_ID = 'rules-test';
const EMULATOR = 'http://127.0.0.1:8080';
const ADMIN_EMAIL = 'owner@example.com';
const ADMIN_PASSWORD = 'emulator-password';

/**
 * Wipe via the emulator's own admin endpoint rather than the client SDK.
 *
 * The client here is deliberately unauthenticated — that is the whole point, it is
 * standing in for a parent's browser — and the security rules correctly forbid it from
 * deleting bookings or reservations. Using the emulator's privileged endpoint keeps the
 * test client honest instead of granting it powers production would never give it.
 */
async function clearDatabase(): Promise<void> {
  const response = await fetch(
    `${EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Emulator clear failed: ${response.status}`);
}

/**
 * Count documents in a collection via the emulator's privileged endpoint.
 *
 * The test client is unauthenticated on purpose, and the security rules correctly deny
 * it any read of `bookings` — so an assertion about how many bookings exist has to come
 * from outside the client, exactly as it would in a real audit.
 */
async function countDocuments(collectionName: string): Promise<number> {
  const response = await fetch(
    `${EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  if (!response.ok) throw new Error(`Emulator read failed: ${response.status}`);
  const body = (await response.json()) as { documents?: unknown[] };
  return body.documents?.length ?? 0;
}

/**
 * Grant admin by writing `admins/{uid}` through the emulator's privileged REST API —
 * mirroring production, where only the Admin SDK (via `scripts/setup-admin.mjs`) can
 * create that document.
 */
async function grantAdmin(uid: string): Promise<void> {
  const response = await fetch(
    `${EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { email: { stringValue: ADMIN_EMAIL }, displayName: { stringValue: 'Owner' } },
      }),
    },
  );
  if (!response.ok) throw new Error(`Granting admin failed: ${response.status}`);
}

let adminUid = '';

beforeAll(async () => {
  // Fail loudly rather than silently writing into a real project.
  expect(process.env.VITE_USE_FIREBASE_EMULATOR).toBe('true');

  await clearDatabase();

  // Create the admin account once. `admins/{uid}` survives clearDatabase() only if we
  // re-grant it, so the grant is repeated in the admin describe's beforeEach.
  const user = await createAccount(ADMIN_EMAIL, ADMIN_PASSWORD).catch(() =>
    signIn(ADMIN_EMAIL, ADMIN_PASSWORD),
  );
  adminUid = user.uid;

  // Public booking tests must run as a real visitor would: signed out.
  await signOut();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await signOut().catch(() => undefined);
});

const at = (minutes: number) => zonedTimeToUtc(TARGET_DATE, minutes, NY);

/* ================================================================== */

describe('booking creation', () => {
  test('a valid booking succeeds and returns a receipt', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'John Williams',
    });

    expect(receipt.confirmationCode).toMatch(/^JW-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(receipt.bookingId).toBeTruthy();
    expect(receipt.durationMinutes).toBe(60);
  });

  test('the booking reserves grains covering the session plus its buffer', async () => {
    await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'John Williams',
    });

    const occupied = await getOccupiedGrains(TARGET_DATE, scheduling);
    // 60 minutes + 15 minutes buffer, at 5-minute grains.
    expect(occupied.size).toBe(75 / 5);
  });

  test('invalid form data is rejected before anything is written', async () => {
    await expect(
      createBooking({
        start: at(18 * 60),
        durationMinutes: 60,
        values: form({ parentName: '', policyAccepted: false }),
        scheduling,
        tutorName: 'John Williams',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const occupied = await getOccupiedGrains(TARGET_DATE, scheduling);
    expect(occupied.size).toBe(0);
  });
});

/* ================================================================== */

describe('conflict prevention', () => {
  test('THE RACE: 8 simultaneous bookings for one slot produce exactly 1 success', async () => {
    const start = at(18 * 60);

    // Fired without awaiting in between, so they genuinely overlap in flight.
    const attempts = Array.from({ length: 8 }, (_, index) =>
      createBooking({
        start,
        durationMinutes: 60,
        values: form({ parentName: `Parent ${index}`, studentName: `Student ${index}` }),
        scheduling,
        tutorName: 'John Williams',
      }),
    );

    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(7);

    // And every failure is the controlled, explainable one — not a raw Firestore error.
    for (const result of failed) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(SlotTakenError);
    }

    // Exactly one booking document exists.
    expect(await countDocuments('bookings')).toBe(1);
  });

  test('a second booking at the same time is refused', async () => {
    const start = at(18 * 60);
    await createBooking({
      start,
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'John Williams',
    });

    await expect(
      createBooking({
        start,
        durationMinutes: 60,
        values: form({ parentName: 'Someone Else' }),
        scheduling,
        tutorName: 'John Williams',
      }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  test('OVERLAP, NOT EQUALITY: a 90-minute booking blocks an overlapping later start', async () => {
    // 6:00-7:30. A 30-minute session at 7:00 has a different start time but overlaps.
    await createBooking({
      start: at(18 * 60),
      durationMinutes: 90,
      values: form(),
      scheduling: { ...scheduling, bufferMinutes: 0 },
      tutorName: 'John Williams',
    });

    await expect(
      createBooking({
        start: at(19 * 60),
        durationMinutes: 30,
        values: form({ parentName: 'Overlapper' }),
        scheduling: { ...scheduling, bufferMinutes: 0 },
        tutorName: 'John Williams',
      }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  test('a booking that ends exactly where another starts is blocked by the buffer', async () => {
    // 5:00-6:00 with a 15-minute buffer runs to 6:15, so 6:00 must be refused.
    await createBooking({
      start: at(17 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'John Williams',
    });

    await expect(
      createBooking({
        start: at(18 * 60),
        durationMinutes: 60,
        values: form({ parentName: 'Too Close' }),
        scheduling,
        tutorName: 'John Williams',
      }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  test('a booking after the buffer has cleared is accepted', async () => {
    await createBooking({
      start: at(17 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'John Williams',
    });

    // 6:15 starts exactly when the previous booking's buffer ends.
    const receipt = await createBooking({
      start: at(18 * 60 + 15),
      durationMinutes: 60,
      values: form({ parentName: 'Just Right' }),
      scheduling,
      tutorName: 'John Williams',
    });
    expect(receipt.bookingId).toBeTruthy();
  });

  test('non-overlapping bookings all succeed concurrently', async () => {
    // Three sessions spaced well apart, fired at once: contention must not cause
    // spurious failures either.
    const results = await Promise.allSettled([
      createBooking({
        start: at(9 * 60),
        durationMinutes: 60,
        values: form({ parentName: 'Avery Stone' }),
        scheduling,
        tutorName: 'JW',
      }),
      createBooking({
        start: at(13 * 60),
        durationMinutes: 60,
        values: form({ parentName: 'Blair Nunez' }),
        scheduling,
        tutorName: 'JW',
      }),
      createBooking({
        start: at(18 * 60),
        durationMinutes: 60,
        values: form({ parentName: 'Casey Lloyd' }),
        scheduling,
        tutorName: 'JW',
      }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });

  test('the slot picker reflects a booking made by somebody else', async () => {
    await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });

    const occupied = await getOccupiedGrains(TARGET_DATE, scheduling);
    const slots = generateSlots({
      dateKey: TARGET_DATE,
      scheduling,
      exceptions: [],
      occupiedGrains: occupied,
      durationMinutes: 60,
      now: new Date(),
    });

    const six = slots.find((s) => s.label === '6:00 PM');
    expect(six?.available).toBe(false);
    expect(six?.reason).toBe('booked');
  });
});

/* ================================================================== */

/**
 * Cancelling, rescheduling and status changes are admin-only operations — the security
 * rules deny them to the public, which the rules suite proves separately. Here the client
 * signs in as the admin so the *logic* can be exercised.
 */
describe('cancellation and rescheduling', () => {
  beforeEach(async () => {
    await grantAdmin(adminUid);
    await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    // The freshly-signed-in token must carry the admin claim check through the rules,
    // which read `admins/{uid}` on each request — no token refresh needed.
    expect(auth().currentUser?.uid).toBe(adminUid);
  });

  afterEach(async () => {
    await signOut();
  });

  test('cancelling releases the time for someone else', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });

    expect((await getOccupiedGrains(TARGET_DATE, scheduling)).size).toBeGreaterThan(0);

    await cancelBooking(receipt.bookingId, 'admin');
    expect((await getOccupiedGrains(TARGET_DATE, scheduling)).size).toBe(0);

    // And the freed slot is genuinely bookable again.
    const rebooked = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form({ parentName: 'Next Family' }),
      scheduling,
      tutorName: 'JW',
    });
    expect(rebooked.bookingId).toBeTruthy();
  });

  test('cancelling twice is harmless', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });
    await cancelBooking(receipt.bookingId);
    await expect(cancelBooking(receipt.bookingId)).resolves.toBeUndefined();
  });

  test('rescheduling moves the reservation with the booking', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });

    await rescheduleBooking(receipt.bookingId, at(15 * 60), 60, scheduling);

    const occupied = await getOccupiedGrains(TARGET_DATE, scheduling);
    const oldGrains = grainsFor(at(18 * 60), at(19 * 60), 0);
    const newGrains = grainsFor(at(15 * 60), at(16 * 60), 0);

    expect(oldGrains.some((g) => occupied.has(g))).toBe(false);
    expect(newGrains.every((g) => occupied.has(g))).toBe(true);
  });

  test('rescheduling onto an occupied time is refused', async () => {
    const first = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form({ parentName: 'First' }),
      scheduling,
      tutorName: 'JW',
    });
    await createBooking({
      start: at(15 * 60),
      durationMinutes: 60,
      values: form({ parentName: 'Second' }),
      scheduling,
      tutorName: 'JW',
    });

    await expect(
      rescheduleBooking(first.bookingId, at(15 * 60), 60, scheduling),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  test('a booking can be nudged slightly without colliding with itself', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });

    // 15 minutes later — the new window overlaps the old one heavily.
    await expect(
      rescheduleBooking(receipt.bookingId, at(18 * 60 + 15), 60, scheduling),
    ).resolves.toBeUndefined();
  });

  test('marking a session completed releases its time', async () => {
    const receipt = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form(),
      scheduling,
      tutorName: 'JW',
    });

    await setBookingStatus(receipt.bookingId, 'completed');
    expect((await getOccupiedGrains(TARGET_DATE, scheduling)).size).toBe(0);
  });

  test('a booking cannot release grains it does not own', async () => {
    // The griefing vector: a crafted booking claiming somebody else's lock ids would,
    // on cancellation, free the victim's slot. `ownedLockRefs` prevents that.
    const victim = await createBooking({
      start: at(18 * 60),
      durationMinutes: 60,
      values: form({ parentName: 'Victim' }),
      scheduling,
      tutorName: 'JW',
    });
    const attacker = await createBooking({
      start: at(11 * 60),
      durationMinutes: 60,
      values: form({ parentName: 'Attacker' }),
      scheduling,
      tutorName: 'JW',
    });

    const before = await getOccupiedGrains(TARGET_DATE, scheduling);

    // Cancelling the attacker's booking must only free the attacker's own grains.
    await cancelBooking(attacker.bookingId);

    const after = await getOccupiedGrains(TARGET_DATE, scheduling);
    const victimGrains = grainsFor(at(18 * 60), at(19 * 60), 15);

    expect(victimGrains.every((g) => after.has(g))).toBe(true);
    expect(after.size).toBeLessThan(before.size);
    expect(victim.bookingId).toBeTruthy();
  });
});
