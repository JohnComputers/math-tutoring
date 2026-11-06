/**
 * Availability exceptions — one-off overrides of the weekly schedule.
 *
 * The recurring weekly grid lives on `settings/scheduling`; this collection holds the
 * dated exceptions layered over it (see `resolvePeriodsForDate`).
 *
 * Publicly readable: the booking calendar has to know a date is blocked before someone
 * tries to book it. The `reason` field is admin-facing free text — it is fetched by the
 * public client but never rendered, so keep it non-sensitive ("Away", not a home address).
 */

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getDoc } from 'firebase/firestore';
import { effectiveSettings,publishAvailability } from '@/shared/engine';
import type { AvailabilityException, ExceptionKind, IsoDate } from '@/types';
import { logError } from '@/utils/errors';

const COLLECTION = 'exceptions';

function toException(id: string, data: Record<string, unknown>): AvailabilityException {
  const rawPeriods = Array.isArray(data.periods) ? data.periods : [];
  return {
    id,
    date: String(data.date ?? ''),
    kind: (String(data.kind ?? 'blockAll') as ExceptionKind) ?? 'blockAll',
    periods: rawPeriods
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map((p) => ({ start: Number(p.start ?? 0), end: Number(p.end ?? 0) })),
    reason: String(data.reason ?? ''),
    createdAt: data.createdAt as AvailabilityException['createdAt'],
  };
}

/**
 * Exceptions in a date range, inclusive. The public calendar asks for exactly the window
 * it renders rather than the whole collection, so a tutor with years of history does not
 * make every visitor download all of it.
 */
export async function getExceptions(
  fromDate: IsoDate,
  toDate: IsoDate,
): Promise<AvailabilityException[]> {
  try {
    const snapshot = await getDocs(
      query(
        collection(db(), COLLECTION),
        where('date', '>=', fromDate),
        where('date', '<=', toDate),
        orderBy('date'),
      ),
    );
    return snapshot.docs.map((d) => toException(d.id, d.data()));
  } catch (error) {
    logError('availability.getExceptions', error);
    // Returning [] means "no overrides", i.e. the normal weekly schedule applies. That is
    // the safe direction: it can never invent availability that the weekly grid denies.
    throw error;
  }
}

/** Every exception from today forward — the admin list view. */
export async function getUpcomingExceptions(
  fromDate: IsoDate,
): Promise<AvailabilityException[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db(), COLLECTION), where('date', '>=', fromDate), orderBy('date')),
    );
    return snapshot.docs.map((d) => toException(d.id, d.data()));
  } catch (error) {
    logError('availability.getUpcomingExceptions', error);
    throw error;
  }
}

async function publishExceptionChange(change:{add?:AvailabilityException;remove?:string;patch?:Partial<AvailabilityException>}){
 const snap=await getDoc(doc(db(),'settings','scheduling'));const settings=effectiveSettings(snap.data());
 const allSnap=await getDocs(collection(db(),COLLECTION));let all=allSnap.docs.map(d=>toException(d.id,d.data()));
 if(change.remove)all=all.filter(e=>e.id!==change.remove);if(change.patch)all=all.map(e=>e.id===change.patch!.id?{...e,...change.patch}:e);if(change.add)all.push(change.add);
 await publishAvailability(settings,all,settings.revision,tx=>{if(change.remove)tx.delete(doc(db(),COLLECTION,change.remove));if(change.patch){const{id,...patch}=change.patch;tx.update(doc(db(),COLLECTION,id!),patch);}if(change.add){const{id,...data}=change.add;tx.set(doc(db(),COLLECTION,id),{...data,createdAt:serverTimestamp()});}});
}
export async function createException(exception:Omit<AvailabilityException,'id'|'createdAt'>):Promise<string>{const id=doc(collection(db(),COLLECTION)).id;await publishExceptionChange({add:{...exception,id}});return id;}
export async function updateException(id:string,patch:Partial<Omit<AvailabilityException,'id'>>):Promise<void>{await publishExceptionChange({patch:{...patch,id}});}
export async function deleteException(id:string):Promise<void>{await publishExceptionChange({remove:id});}

/**
 * Remove exceptions for dates that have passed.
 *
 * Purely housekeeping: stale exceptions are harmless but they bloat the range query the
 * public calendar runs. Offered as an admin button, never automatic.
 */
export async function pruneExceptionsBefore(dateKey: IsoDate): Promise<number> {
  const snapshot = await getDocs(
    query(collection(db(), COLLECTION), where('date', '<', dateKey)),
  );
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
  return snapshot.size;
}

/** Convenience for the admin UI, which shows "added on ...". */
export function exceptionCreatedAt(exception: AvailabilityException): Date | null {
  const value = exception.createdAt;
  return value instanceof Timestamp ? value.toDate() : null;
}
