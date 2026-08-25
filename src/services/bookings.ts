/**
 * Bookings, and the concurrency control that keeps two families out of the same hour.
 *
 * ## The guarantee
 *
 * A booking is not a single document write. It is a transaction that:
 *   1. reads every reservation grain the session would occupy (buffer included),
 *   2. aborts if *any* of them already exists,
 *   3. otherwise writes the booking document and all of its grain documents together.
 *
 * Firestore transactions are optimistic: if another client writes any document this
 * transaction read, the commit fails and the SDK retries with fresh reads. So the check
 * in step 2 cannot go stale between the read and the write — that window is exactly what
 * the transaction closes. Two simultaneous bookings for 6:00 PM produce one success and
 * one `SlotTakenError`, never two bookings.
 *
 * ## Defence in depth
 *
 * The transaction is the primary mechanism. `firestore.rules` is the second: grain
 * documents allow `create` but never `update` from the public, so even a client that
 * skipped the transaction entirely and issued a raw `set()` over an existing grain would
 * be rejected by the server. Client-side slot filtering is a third layer, and the only
 * one that is purely cosmetic — it exists so people do not click a doomed button.
 *
 * ## What the rules cannot enforce
 *
 * Firestore rules can validate a booking's *shape*, but they cannot evaluate the
 * availability algorithm, so they cannot prove a booking falls inside the tutor's
 * configured hours. A crafted request could therefore create a structurally valid
 * booking at 3 AM. It cannot double-book, cannot read anyone else's data, and shows up
 * in the admin dashboard to be cancelled. Closing that last gap needs server-side code
 * (a Cloud Function), which is outside a static GitHub Pages deployment. This is
 * documented in the README under "Security model and its limits".
 */

import {
  type Transaction,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  Booking,
  BookingFormValues,
  BookingStatus,
  IsoDate,
  SchedulingSettings,
} from '@/types';
import { SlotTakenError, ValidationError, logError } from '@/utils/errors';
import {
  MAX_LOCKS_PER_BOOKING,
  dayGrainBounds,
  grainDocId,
  grainFromDocId,
  grainsFor,
} from '@/utils/slots';
import { addDays, toDateKey } from '@/utils/time';
import {
  cleanMultiline,
  cleanText,
  generateConfirmationCode,
  hasErrors,
  initialsOf,
  normalisePhone,
  validateBookingForm,
} from '@/utils/validation';

const BOOKINGS = 'bookings';
const LOCKS = 'slotLocks';

/* ------------------------------------------------------------------ */
/* Reading reservations (public)                                       */
/* ------------------------------------------------------------------ */

/**
 * Grains reserved around a date. Publicly readable *because it contains no personal
 * information* — just which slices of the timeline are spoken for. The bookings
 * themselves stay admin-only.
 */
export async function getOccupiedGrains(
  dateKey: IsoDate,
  scheduling: SchedulingSettings,
): Promise<Set<number>> {
  const { first, last } = dayGrainBounds(dateKey, scheduling.timezone, scheduling.bufferMinutes);
  try {
    const snapshot = await getDocs(
      query(
        collection(db(), LOCKS),
        where('grain', '>=', first),
        where('grain', '<=', last),
      ),
    );
    const grains = new Set<number>();
    for (const docSnap of snapshot.docs) {
      const value = docSnap.data().grain;
      grains.add(typeof value === 'number' ? value : grainFromDocId(docSnap.id));
    }
    return grains;
  } catch (error) {
    logError('bookings.getOccupiedGrains', error);
    // Rethrow: silently returning an empty set would show every slot as free and let
    // people book straight into a collision. Better to tell them the calendar is down.
    throw error;
  }
}

/** Same, for a range of days — used by the admin availability preview. */
export async function getOccupiedGrainsForRange(
  fromDateKey: IsoDate,
  toDateKey: IsoDate,
  scheduling: SchedulingSettings,
): Promise<Set<number>> {
  const start = dayGrainBounds(fromDateKey, scheduling.timezone, scheduling.bufferMinutes);
  const end = dayGrainBounds(toDateKey, scheduling.timezone, scheduling.bufferMinutes);
  const snapshot = await getDocs(
    query(
      collection(db(), LOCKS),
      where('grain', '>=', start.first),
      where('grain', '<=', end.last),
    ),
  );
  const grains = new Set<number>();
  for (const docSnap of snapshot.docs) {
    const value = docSnap.data().grain;
    grains.add(typeof value === 'number' ? value : grainFromDocId(docSnap.id));
  }
  return grains;
}

/* ------------------------------------------------------------------ */
/* Creating a booking                                                  */
/* ------------------------------------------------------------------ */

export interface CreateBookingInput {
  start: Date;
  durationMinutes: number;
  values: BookingFormValues;
  scheduling: SchedulingSettings;
  /** Used only for the confirmation-code prefix. */
  tutorName: string;
}

/** What the confirmation screen needs. Deliberately not the raw Firestore document. */
export interface BookingReceipt {
  bookingId: string;
  confirmationCode: string;
  parentName: string;
  studentName: string;
  phone: string;
  email: string;
  subject: string;
  notes: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  timezone: string;
}

/**
 * Reserve a slot. Throws `ValidationError` for bad input and `SlotTakenError` when the
 * time went while the form was being filled in.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingReceipt> {
  const { start, durationMinutes, values, scheduling, tutorName } = input;

  const errors = validateBookingForm(values, scheduling);
  if (hasErrors(errors)) throw new ValidationError(errors);

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new ValidationError({}, 'That session length is not valid.');
  }
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new ValidationError({}, 'That start time is not valid.');
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const grains = grainsFor(start, end, scheduling.bufferMinutes);
  if (grains.length === 0 || grains.length > MAX_LOCKS_PER_BOOKING) {
    throw new ValidationError({}, 'That session length is not valid.');
  }

  const bookingRef = doc(collection(db(), BOOKINGS));
  const confirmationCode = generateConfirmationCode(initialsOf(tutorName));

  const payload = {
    confirmationCode,
    parentName: cleanText(values.parentName),
    studentName: cleanText(values.studentName),
    phone: normalisePhone(values.phone),
    email: cleanText(values.email).toLowerCase(),
    subject: cleanText(values.subject),
    notes: cleanMultiline(values.notes),
    startAt: Timestamp.fromDate(start),
    endAt: Timestamp.fromDate(end),
    durationMinutes,
    dateKey: toDateKey(start, scheduling.timezone),
    timezone: scheduling.timezone,
    status: 'confirmed' as BookingStatus,
    internalNotes: '',
    lockIds: grains.map(grainDocId),
    policyAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  try {
    await runTransaction(db(), async (transaction: Transaction) => {
      // ---- Phase 1: reads. Firestore requires every read before any write. ----
      const lockRefs = grains.map((grain) => doc(db(), LOCKS, grainDocId(grain)));
      const lockSnapshots = await Promise.all(
        lockRefs.map((ref) => transaction.get(ref)),
      );

      const taken = lockSnapshots.some((snapshot) => snapshot.exists());
      if (taken) throw new SlotTakenError();

      // ---- Phase 2: writes, committed atomically with the reads above. ----
      transaction.set(bookingRef, payload);
      lockRefs.forEach((ref, index) => {
        transaction.set(ref, {
          grain: grains[index],
          bookingId: bookingRef.id,
          createdAt: serverTimestamp(),
        });
      });
    });
  } catch (error) {
    if (error instanceof SlotTakenError) throw error;
    logError('bookings.createBooking', error);
    throw error;
  }

  return {
    bookingId: bookingRef.id,
    confirmationCode,
    parentName: payload.parentName,
    studentName: payload.studentName,
    phone: payload.phone,
    email: payload.email,
    subject: payload.subject,
    notes: payload.notes,
    start,
    end,
    durationMinutes,
    timezone: scheduling.timezone,
  };
}

/* ------------------------------------------------------------------ */
/* Reading bookings (admin only)                                       */
/* ------------------------------------------------------------------ */

function toBooking(id: string, data: Record<string, unknown>): Booking {
  return {
    id,
    confirmationCode: String(data.confirmationCode ?? ''),
    parentName: String(data.parentName ?? ''),
    studentName: String(data.studentName ?? ''),
    phone: String(data.phone ?? ''),
    email: String(data.email ?? ''),
    subject: String(data.subject ?? ''),
    notes: String(data.notes ?? ''),
    startAt: data.startAt as Booking['startAt'],
    endAt: data.endAt as Booking['endAt'],
    durationMinutes: Number(data.durationMinutes ?? 0),
    dateKey: String(data.dateKey ?? ''),
    timezone: String(data.timezone ?? 'America/New_York'),
    status: (String(data.status ?? 'confirmed') as BookingStatus),
    internalNotes: String(data.internalNotes ?? ''),
    lockIds: Array.isArray(data.lockIds) ? data.lockIds.map(String) : [],
    policyAcceptedAt: data.policyAcceptedAt as Booking['policyAcceptedAt'],
    createdAt: data.createdAt as Booking['createdAt'],
    updatedAt: data.updatedAt as Booking['updatedAt'],
    cancelledAt: data.cancelledAt as Booking['cancelledAt'],
    cancelledBy: data.cancelledBy ? String(data.cancelledBy) : undefined,
  };
}

export interface BookingQuery {
  /** Inclusive date-key lower bound. */
  fromDate?: IsoDate;
  /** Inclusive date-key upper bound. */
  toDate?: IsoDate;
  status?: BookingStatus | 'all';
  max?: number;
}

/**
 * Bookings, newest-first within the requested window.
 *
 * Always bounded: an unbounded query would grow without limit and eventually time out
 * on the admin dashboard. Callers pass the window they actually render.
 */
export async function getBookings(options: BookingQuery = {}): Promise<Booking[]> {
  const { fromDate, toDate, status = 'all', max = 200 } = options;

  const constraints = [];
  if (fromDate) constraints.push(where('dateKey', '>=', fromDate));
  if (toDate) constraints.push(where('dateKey', '<=', toDate));
  if (status !== 'all') constraints.push(where('status', '==', status));

  // `dateKey` needs to lead the ordering because it carries the range filter.
  const snapshot = await getDocs(
    query(
      collection(db(), BOOKINGS),
      ...constraints,
      orderBy('dateKey', 'desc'),
      orderBy('startAt', 'desc'),
      limitTo(max),
    ),
  );
  return snapshot.docs.map((d) => toBooking(d.id, d.data()));
}

/** Confirmed sessions from `fromDate` onward, soonest first. */
export async function getUpcomingBookings(
  fromDate: IsoDate,
  max = 100,
): Promise<Booking[]> {
  const snapshot = await getDocs(
    query(
      collection(db(), BOOKINGS),
      where('dateKey', '>=', fromDate),
      where('status', '==', 'confirmed'),
      orderBy('dateKey'),
      orderBy('startAt'),
      limitTo(max),
    ),
  );
  return snapshot.docs.map((d) => toBooking(d.id, d.data()));
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(db(), BOOKINGS, id));
  return snapshot.exists() ? toBooking(snapshot.id, snapshot.data()) : null;
}

/* ------------------------------------------------------------------ */
/* Mutating bookings (admin only)                                      */
/* ------------------------------------------------------------------ */

/**
 * Read a booking's grain documents and keep only the ones it actually owns.
 *
 * `lockIds` arrives from a document the public can create, so it is untrusted input.
 * Without this check, a crafted booking listing *someone else's* grain IDs would, on
 * cancellation, delete that person's reservation and quietly free their slot. Firestore
 * rules cannot catch this — they cannot iterate a variable-length array — so ownership
 * is verified here, where the grain's own `bookingId` field settles it.
 *
 * Must be called during the read phase of a transaction, before any write.
 */
async function ownedLockRefs(
  transaction: Transaction,
  bookingId: string,
  lockIds: string[],
): Promise<ReturnType<typeof doc>[]> {
  const refs = lockIds.slice(0, MAX_LOCKS_PER_BOOKING).map((id) => doc(db(), LOCKS, id));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  return refs.filter((_ref, index) => {
    const snapshot = snapshots[index];
    return snapshot?.exists() && snapshot.data()?.bookingId === bookingId;
  });
}

/**
 * Cancel a booking and release its grains, making the time bookable again.
 *
 * Grains are deleted rather than flagged so the public range query stays cheap: a
 * cancelled booking should cost nothing to read around. Availability *exceptions* are a
 * separate collection, so an admin block over the same date still applies afterwards.
 */
export async function cancelBooking(id: string, cancelledBy = 'admin'): Promise<void> {
  await runTransaction(db(), async (transaction) => {
    const bookingRef = doc(db(), BOOKINGS, id);
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists()) throw new Error('That booking no longer exists.');

    const booking = toBooking(snapshot.id, snapshot.data());
    if (booking.status === 'cancelled') return; // already done; make this idempotent

    const releasable = await ownedLockRefs(transaction, id, booking.lockIds);

    transaction.update(bookingRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy,
      updatedAt: serverTimestamp(),
    });
    for (const lockRef of releasable) {
      transaction.delete(lockRef);
    }
  });
}

/**
 * Move a booking to a new time, running the same conflict check a fresh booking runs.
 *
 * Grains this booking already holds do not block it — otherwise a 15-minute nudge would
 * always collide with itself.
 */
export async function rescheduleBooking(
  id: string,
  newStart: Date,
  durationMinutes: number,
  scheduling: SchedulingSettings,
): Promise<void> {
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);
  const newGrains = grainsFor(newStart, newEnd, scheduling.bufferMinutes);
  if (newGrains.length === 0 || newGrains.length > MAX_LOCKS_PER_BOOKING) {
    throw new ValidationError({}, 'That session length is not valid.');
  }

  await runTransaction(db(), async (transaction) => {
    const bookingRef = doc(db(), BOOKINGS, id);

    // ---- Reads ----
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists()) throw new Error('That booking no longer exists.');
    const booking = toBooking(bookingSnapshot.id, bookingSnapshot.data());

    const newLockRefs = newGrains.map((grain) => doc(db(), LOCKS, grainDocId(grain)));
    const newLockSnapshots = await Promise.all(
      newLockRefs.map((ref) => transaction.get(ref)),
    );

    const conflict = newLockSnapshots.some(
      (snapshot) => snapshot.exists() && snapshot.data()?.bookingId !== id,
    );
    if (conflict) throw new SlotTakenError('That time is already taken.');

    // Only release grains this booking genuinely owns — see `ownedLockRefs`.
    const releasable = await ownedLockRefs(transaction, id, booking.lockIds);

    // ---- Writes ----
    // Diff rather than delete-then-recreate: overlapping grains stay untouched, so the
    // ordering of deletes and sets inside the batch cannot matter.
    const previous = new Set(booking.lockIds);
    const next = new Set(newLockRefs.map((ref) => ref.id));

    for (const lockRef of releasable) {
      if (!next.has(lockRef.id)) transaction.delete(lockRef);
    }
    newLockRefs.forEach((ref, index) => {
      if (!previous.has(ref.id)) {
        transaction.set(ref, {
          grain: newGrains[index],
          bookingId: id,
          createdAt: serverTimestamp(),
        });
      }
    });

    transaction.update(bookingRef, {
      startAt: Timestamp.fromDate(newStart),
      endAt: Timestamp.fromDate(newEnd),
      durationMinutes,
      dateKey: toDateKey(newStart, scheduling.timezone),
      timezone: scheduling.timezone,
      // A cancelled booking that is rescheduled becomes live again.
      status: 'confirmed' as BookingStatus,
      lockIds: [...next],
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Set a terminal status. Completed and no-show sessions release their grains: the time
 * has passed, and holding it forever would slowly fill the calendar with ghosts.
 */
export async function setBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<void> {
  if (status === 'cancelled') return cancelBooking(id);

  await runTransaction(db(), async (transaction) => {
    const bookingRef = doc(db(), BOOKINGS, id);
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists()) throw new Error('That booking no longer exists.');
    const booking = toBooking(snapshot.id, snapshot.data());

    const releasing = status === 'completed' || status === 'noShow';
    const releasable = releasing
      ? await ownedLockRefs(transaction, id, booking.lockIds)
      : [];

    transaction.update(bookingRef, { status, updatedAt: serverTimestamp() });
    for (const lockRef of releasable) {
      transaction.delete(lockRef);
    }
  });
}

export async function setInternalNotes(id: string, notes: string): Promise<void> {
  await updateDoc(doc(db(), BOOKINGS, id), {
    internalNotes: cleanMultiline(notes).slice(0, 2000),
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

/**
 * Delete grains left behind by bookings that no longer exist or are no longer live.
 *
 * Orphans should not happen — every path that ends a booking releases its grains inside
 * a transaction — but a browser killed mid-commit is not something a client-only app can
 * fully rule out, and an orphaned grain silently blocks a slot forever. This is the
 * "Release orphaned slots" button in Admin -> Settings.
 */
export async function releaseOrphanedLocks(
  fromDateKey: IsoDate,
  scheduling: SchedulingSettings,
): Promise<number> {
  const bounds = dayGrainBounds(
    addDays(fromDateKey, 0),
    scheduling.timezone,
    scheduling.bufferMinutes,
  );
  const lockSnapshot = await getDocs(
    query(collection(db(), LOCKS), where('grain', '>=', bounds.first)),
  );

  const liveBookingIds = new Set<string>();
  const bookingSnapshot = await getDocs(
    query(
      collection(db(), BOOKINGS),
      where('dateKey', '>=', fromDateKey),
      where('status', '==', 'confirmed'),
    ),
  );
  for (const docSnap of bookingSnapshot.docs) liveBookingIds.add(docSnap.id);

  let released = 0;
  for (const lockDoc of lockSnapshot.docs) {
    const bookingId = String(lockDoc.data().bookingId ?? '');
    if (!bookingId || !liveBookingIds.has(bookingId)) {
      await runTransaction(db(), async (transaction) => {
        const fresh = await transaction.get(lockDoc.ref);
        if (fresh.exists()) transaction.delete(lockDoc.ref);
      });
      released += 1;
    }
  }
  return released;
}
