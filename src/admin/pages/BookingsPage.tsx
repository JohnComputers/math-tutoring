import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Booking, BookingStatus } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import {
  cancelBooking,
  getBookings,
  setBookingStatus,
  setInternalNotes,
} from '@/services/bookings';
import { handleError } from '@/utils/errors';
import {
  addDays,
  formatDateKey,
  formatInstantTime,
  timeZoneAbbreviation,
  todayDateKey,
} from '@/utils/time';
import { formatPhone, telHref } from '@/utils/validation';
import { Alert, EmptyState, LoadingPanel } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { AdminCard, AdminPageHeader, StatusPill } from '../components/AdminUi';
import { RescheduleDialog } from '../components/RescheduleDialog';

/**
 * Booking management.
 *
 * Filtering by date range and status happens in Firestore (so the query stays bounded);
 * the name search runs in memory over the already-fetched page, because Firestore has no
 * substring search and adding one would mean a second service for a list this small.
 *
 * Every destructive action goes through a confirmation dialog — cancelling a session
 * texts nobody automatically, so an accidental click would be silently costly.
 */

type RangeKey = 'upcoming' | 'today' | 'week' | 'past' | 'all';

const RANGE_LABELS: Record<RangeKey, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  week: 'Next 7 days',
  past: 'Past',
  all: 'All time',
};

export function BookingsPage() {
  const { scheduling } = useSiteContent();
  const todayKey = todayDateKey(scheduling.timezone);

  const [range, setRange] = useState<RangeKey>('upcoming');
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query =
        range === 'upcoming'
          ? { fromDate: todayKey }
          : range === 'today'
            ? { fromDate: todayKey, toDate: todayKey }
            : range === 'week'
              ? { fromDate: todayKey, toDate: addDays(todayKey, 7) }
              : range === 'past'
                ? { toDate: addDays(todayKey, -1) }
                : {};

      setBookings(await getBookings({ ...query, status, max: 300 }));
    } catch (caught) {
      setError(
        handleError(
          'BookingsPage.load',
          caught,
          'Could not load bookings. If this is a new project, the Firestore indexes may still be building — that usually takes a minute.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [range, status, todayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter(
      (booking) =>
        booking.parentName.toLowerCase().includes(needle) ||
        booking.studentName.toLowerCase().includes(needle) ||
        booking.confirmationCode.toLowerCase().includes(needle) ||
        booking.phone.includes(needle),
    );
  }, [bookings, search]);

  const runAction = async (
    action: () => Promise<void>,
    context: string,
    successMessage: string,
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      await load();
    } catch (caught) {
      setError(handleError(context, caught, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const zone = timeZoneAbbreviation(scheduling.timezone);

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Bookings"
        description={`All times shown in ${zone}.`}
        actions={
          <button type="button" className="btn btn--sm btn--ghost-dark" onClick={() => void load()}>
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <AdminCard>
        <div className="filter-row">
          <SelectField
            label="Date range"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeKey)}
          >
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <option key={key} value={key}>
                {RANGE_LABELS[key]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="noShow">No-show</option>
          </SelectField>

          <TextField
            label="Search"
            type="search"
            placeholder="Name, phone or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </AdminCard>

      {loading ? (
        <LoadingPanel message="Loading bookings..." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={search ? 'No matches' : 'No bookings here'}
          description={
            search
              ? 'Try a different name, phone number or confirmation code.'
              : 'Bookings made through the website will appear here.'
          }
        />
      ) : (
        <>
          <p className="admin-count">
            {visible.length} booking{visible.length === 1 ? '' : 's'}
          </p>

          {/* Cards on every screen size: a table forced into a phone either scrolls
              sideways or shrinks its text to nothing. Cards just stack. */}
          <ul className="booking-list">
            {visible.map((booking) => (
              <li key={booking.id}>
                <article
                  className={`booking-card ${booking.status !== 'confirmed' ? 'is-inactive' : ''}`.trim()}
                >
                  <div className="booking-card__main">
                    <div className="booking-card__when">
                      <span className="booking-card__date">
                        {formatDateKey(booking.dateKey, false)}
                      </span>
                      <span className="booking-card__time">
                        {formatInstantTime(
                          booking.startAt?.toDate?.() ?? new Date(),
                          booking.timezone || scheduling.timezone,
                        )}
                      </span>
                      <span className="booking-card__duration">
                        {booking.durationMinutes} min
                      </span>
                    </div>

                    <div className="booking-card__people">
                      <p className="booking-card__student">{booking.studentName}</p>
                      <p className="booking-card__parent">{booking.parentName}</p>
                      {booking.subject && (
                        <span className="chip chip--neutral">{booking.subject}</span>
                      )}
                    </div>

                    <div className="booking-card__side">
                      <StatusPill status={booking.status} />
                      <code className="booking-card__code">{booking.confirmationCode}</code>
                    </div>
                  </div>

                  <div className="booking-card__foot">
                    <a href={telHref(booking.phone)} className="booking-card__contact">
                      <Icon name="phone" size={14} />
                      {formatPhone(booking.phone)}
                    </a>
                    {booking.email && (
                      <a href={`mailto:${booking.email}`} className="booking-card__contact">
                        <Icon name="mail" size={14} />
                        {booking.email}
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost-dark booking-card__view"
                      onClick={() => setDetail(booking)}
                    >
                      View & manage
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ---- detail / management dialog ---- */}
      <BookingDetail
        booking={detail}
        timezone={scheduling.timezone}
        busy={busy}
        onClose={() => setDetail(null)}
        onCancel={(booking) => {
          setDetail(null);
          setCancelTarget(booking);
        }}
        onReschedule={(booking) => {
          setDetail(null);
          setRescheduleTarget(booking);
        }}
        onStatus={(booking, next) =>
          void runAction(
            () => setBookingStatus(booking.id, next),
            'BookingsPage.setStatus',
            next === 'completed' ? 'Marked as completed.' : 'Marked as a no-show.',
          ).then(() => setDetail(null))
        }
        onNotes={(booking, notes) =>
          void runAction(
            () => setInternalNotes(booking.id, notes),
            'BookingsPage.notes',
            'Notes saved.',
          )
        }
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this booking?"
        destructive
        busy={busy}
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
        message={
          cancelTarget ? (
            <>
              <p>
                <strong>
                  {cancelTarget.studentName} — {formatDateKey(cancelTarget.dateKey, false)} at{' '}
                  {formatInstantTime(
                    cancelTarget.startAt?.toDate?.() ?? new Date(),
                    cancelTarget.timezone || scheduling.timezone,
                  )}
                </strong>
              </p>
              <p style={{ marginTop: 'var(--space-3)' }}>
                The time becomes available for someone else to book. Nobody is notified
                automatically — text {formatPhone(cancelTarget.phone)} to let them know.
              </p>
            </>
          ) : null
        }
        onConfirm={() => {
          const target = cancelTarget;
          if (!target) return;
          setCancelTarget(null);
          void runAction(
            () => cancelBooking(target.id, 'admin'),
            'BookingsPage.cancel',
            'Booking cancelled and the time released.',
          );
        }}
        onCancel={() => setCancelTarget(null)}
      />

      {rescheduleTarget && (
        <RescheduleDialog
          booking={rescheduleTarget}
          scheduling={scheduling}
          onClose={() => setRescheduleTarget(null)}
          onDone={(message) => {
            setRescheduleTarget(null);
            setNotice(message);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BookingDetail({
  booking,
  timezone,
  busy,
  onClose,
  onCancel,
  onReschedule,
  onStatus,
  onNotes,
}: {
  booking: Booking | null;
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onCancel: (booking: Booking) => void;
  onReschedule: (booking: Booking) => void;
  onStatus: (booking: Booking, status: BookingStatus) => void;
  onNotes: (booking: Booking, notes: string) => void;
}) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(booking?.internalNotes ?? '');
  }, [booking]);

  if (!booking) return null;

  const start = booking.startAt?.toDate?.() ?? new Date();
  const created = booking.createdAt?.toDate?.();

  return (
    <Modal
      open
      onClose={onClose}
      title={booking.studentName}
      description={`${formatDateKey(booking.dateKey)} at ${formatInstantTime(start, booking.timezone || timezone)}`}
      size="lg"
      footer={
        <div className="booking-detail__footer">
          {booking.status === 'confirmed' && (
            <>
              <button
                type="button"
                className="btn btn--sm btn--ghost-dark"
                onClick={() => onStatus(booking, 'completed')}
                disabled={busy}
              >
                <Icon name="check" size={15} />
                Completed
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost-dark"
                onClick={() => onStatus(booking, 'noShow')}
                disabled={busy}
              >
                <Icon name="ban" size={15} />
                No-show
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost-dark"
                onClick={() => onReschedule(booking)}
                disabled={busy}
              >
                <Icon name="calendar" size={15} />
                Reschedule
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => onCancel(booking)}
                disabled={busy}
              >
                Cancel booking
              </button>
            </>
          )}
          {booking.status !== 'confirmed' && (
            <button
              type="button"
              className="btn btn--sm btn--ghost-dark"
              onClick={() => onReschedule(booking)}
              disabled={busy}
            >
              <Icon name="calendar" size={15} />
              Reschedule / reinstate
            </button>
          )}
        </div>
      }
    >
      <dl className="booking-detail__grid">
        <Detail label="Status">
          <StatusPill status={booking.status} />
        </Detail>
        <Detail label="Confirmation code">
          <code>{booking.confirmationCode}</code>
        </Detail>
        <Detail label="Parent / Guardian">{booking.parentName}</Detail>
        <Detail label="Student">{booking.studentName}</Detail>
        <Detail label="Phone">
          <a href={telHref(booking.phone)}>{formatPhone(booking.phone)}</a>
        </Detail>
        <Detail label="Email">
          {booking.email ? (
            <a href={`mailto:${booking.email}`}>{booking.email}</a>
          ) : (
            <span className="muted">Not provided</span>
          )}
        </Detail>
        <Detail label="Subject">
          {booking.subject || <span className="muted">Not specified</span>}
        </Detail>
        <Detail label="Duration">{booking.durationMinutes} minutes</Detail>
        <Detail label="Timezone">{booking.timezone}</Detail>
        <Detail label="Booked on">
          {created ? formatDateKey(
            `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`,
            false,
          ) : '—'}
        </Detail>
      </dl>

      {booking.notes && (
        <div className="booking-detail__notes">
          <h3>Notes from the parent</h3>
          <p>{booking.notes}</p>
        </div>
      )}

      <div className="booking-detail__internal">
        <TextAreaField
          label="Your private notes"
          hint="Only visible here. Never shown to the parent or on the website."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
        />
        <button
          type="button"
          className="btn btn--sm btn--ghost-dark"
          onClick={() => onNotes(booking, notes)}
          disabled={busy || notes === booking.internalNotes}
        >
          <Icon name="save" size={15} />
          Save notes
        </button>
      </div>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="booking-detail__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
