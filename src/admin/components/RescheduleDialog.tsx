import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AvailabilityException,
  Booking,
  IsoDate,
  SchedulingSettings,
  TimeSlot,
} from '@/types';
import { getExceptions } from '@/services/availability';
import { getOccupiedGrains, rescheduleBooking } from '@/services/bookings';
import { SlotTakenError, handleError } from '@/utils/errors';
import { generateSlots, grainFromDocId } from '@/utils/slots';
import { addDays, formatDateKey, formatInstantTime, todayDateKey } from '@/utils/time';
import { DatePicker } from '@/components/booking/DatePicker';
import { TimeSlots } from '@/components/booking/TimeSlots';
import { Alert } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/Field';

/**
 * Move an existing booking.
 *
 * Two things make this different from a public booking:
 *
 *   1. Minimum-notice, same-day and advance-window limits are bypassed. Those are
 *      *public booking policy*; the tutor rescheduling their own calendar should not be
 *      told a slot is "too soon" when they are the one moving it.
 *
 *   2. The booking's own grains are ignored when checking conflicts, so nudging a session
 *      by fifteen minutes does not collide with itself.
 *
 * Conflict checking against *other* bookings is not relaxed at all — it runs the same
 * transaction as a public booking, so an admin cannot double-book either.
 */

interface RescheduleDialogProps {
  booking: Booking;
  scheduling: SchedulingSettings;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function RescheduleDialog({
  booking,
  scheduling,
  onClose,
  onDone,
}: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(booking.dateKey);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState(booking.durationMinutes);

  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [occupied, setOccupied] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Grains this booking already holds — it must not block its own move.
  const ownGrains = useMemo(
    () => new Set(booking.lockIds.map(grainFromDocId).filter((n) => Number.isFinite(n))),
    [booking.lockIds],
  );

  useEffect(() => {
    const from = todayDateKey(scheduling.timezone);
    void getExceptions(addDays(from, -1), addDays(from, scheduling.maximumAdvanceDays + 30))
      .then(setExceptions)
      .catch(() => setExceptions([]));
  }, [scheduling.timezone, scheduling.maximumAdvanceDays]);

  const loadOccupied = useCallback(
    async (dateKey: IsoDate) => {
      setLoading(true);
      setError(null);
      try {
        setOccupied(await getOccupiedGrains(dateKey, scheduling));
      } catch (caught) {
        setError(
          handleError(
            'RescheduleDialog.loadOccupied',
            caught,
            'Could not check availability for that date.',
          ),
        );
        setOccupied(new Set());
      } finally {
        setLoading(false);
      }
    },
    [scheduling],
  );

  useEffect(() => {
    if (selectedDate) void loadOccupied(selectedDate);
  }, [selectedDate, loadOccupied]);

  const slots = useMemo(() => {
    if (!selectedDate) return [];
    return generateSlots({
      dateKey: selectedDate,
      scheduling,
      exceptions,
      occupiedGrains: occupied,
      ignoreGrains: ownGrains,
      durationMinutes: duration,
      bypassNoticeRules: true,
    });
  }, [selectedDate, scheduling, exceptions, occupied, ownGrains, duration]);

  const submit = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      await rescheduleBooking(booking.id, selectedSlot.start, duration, scheduling);
      onDone(
        `Moved to ${formatDateKey(selectedDate ?? booking.dateKey, false)} at ${formatInstantTime(
          selectedSlot.start,
          scheduling.timezone,
        )}. Remember to text ${booking.parentName.split(' ')[0]} — nobody is notified automatically.`,
      );
    } catch (caught) {
      if (caught instanceof SlotTakenError) {
        setError('That time was taken while this dialog was open. Please pick another.');
        setSelectedSlot(null);
        if (selectedDate) await loadOccupied(selectedDate);
      } else {
        setError(
          handleError('RescheduleDialog.submit', caught, 'Could not reschedule the booking.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const durations = scheduling.sessionDurations.length
    ? Array.from(new Set([...scheduling.sessionDurations, booking.durationMinutes])).sort(
        (a, b) => a - b,
      )
    : [booking.durationMinutes];

  const currentStart = booking.startAt?.toDate?.() ?? new Date();

  return (
    <Modal
      open
      onClose={submitting ? () => undefined : onClose}
      title="Reschedule session"
      description={`Currently ${formatDateKey(booking.dateKey, false)} at ${formatInstantTime(currentStart, booking.timezone || scheduling.timezone)} — ${booking.studentName}`}
      size="lg"
      footer={
        <div className="btn-row modal__actions">
          <button
            type="button"
            className="btn btn--ghost-dark"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void submit()}
            disabled={!selectedSlot || submitting}
          >
            {submitting && <span className="spinner" aria-hidden="true" />}
            <Icon name="check" size={17} />
            Move session
          </button>
        </div>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      <Alert tone="info" plain>
        Notice periods and the advance-booking window are ignored here, so you can move a
        session anywhere in your availability. Conflicts with other bookings are still
        prevented.
      </Alert>

      {durations.length > 1 && (
        <div className="reschedule__duration">
          <SelectField
            label="Session length"
            value={String(duration)}
            onChange={(event) => {
              setDuration(Number(event.target.value));
              setSelectedSlot(null);
            }}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <div className="reschedule__grid">
        <DatePicker
          scheduling={{ ...scheduling, maximumAdvanceDays: 365, allowSameDayBookings: true }}
          exceptions={exceptions}
          selectedDate={selectedDate}
          onSelect={(dateKey) => {
            setSelectedDate(dateKey);
            setSelectedSlot(null);
          }}
        />

        <TimeSlots
          dateKey={selectedDate}
          slots={slots}
          selectedStart={selectedSlot?.start ?? null}
          onSelect={setSelectedSlot}
          loading={loading}
          error={null}
          scheduling={scheduling}
          {...(selectedDate ? { onRetry: () => void loadOccupied(selectedDate) } : {})}
        />
      </div>
    </Modal>
  );
}
