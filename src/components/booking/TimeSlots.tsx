import type { IsoDate, SchedulingSettings, SlotUnavailableReason, TimeSlot } from '@/types';
import { formatDateKey, timeZoneAbbreviation } from '@/utils/time';
import { Icon } from '@/components/ui/Icon';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback';

/**
 * Time-slot picker.
 *
 * Unavailable slots stay on screen, greyed and disabled, rather than disappearing. A
 * calendar that silently drops taken times looks broken or empty; one that shows them
 * struck through communicates "this is a real schedule and 6pm has gone".
 *
 * Buttons are sized to `--tap-target` and laid out in an auto-fit grid, so they stay
 * comfortably tappable from an iPhone SE up to a desktop.
 */

const REASON_LABELS: Record<SlotUnavailableReason, string> = {
  booked: 'Booked',
  tooSoon: 'Too soon',
  past: 'Passed',
  outsideWindow: 'Not yet open',
  blocked: 'Unavailable',
};

interface TimeSlotsProps {
  dateKey: IsoDate | null;
  slots: TimeSlot[];
  selectedStart: Date | null;
  onSelect: (slot: TimeSlot) => void;
  loading: boolean;
  error: string | null;
  scheduling: SchedulingSettings;
  onRetry?: () => void;
}

export function TimeSlots({
  dateKey,
  slots,
  selectedStart,
  onSelect,
  loading,
  error,
  scheduling,
  onRetry,
}: TimeSlotsProps) {
  const zoneLabel = timeZoneAbbreviation(scheduling.timezone);
  const availableCount = slots.filter((slot) => slot.available).length;

  if (!dateKey) {
    return (
      <div className="slots">
        <EmptyState
          icon="calendar"
          title="Pick a date first"
          description="Choose a day on the calendar and the available times will appear here."
        />
      </div>
    );
  }

  return (
    <div className="slots">
      <div className="slots__header">
        <h3 className="slots__title">{formatDateKey(dateKey)}</h3>
        <p className="slots__zone">
          <Icon name="clock" size={14} />
          Times shown in {zoneLabel}
        </p>
      </div>

      {loading && (
        <div className="slots__grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="var(--tap-target)" radius="var(--radius-md)" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert tone="error">
          <p>{error}</p>
          {onRetry && (
            <button
              type="button"
              className="btn btn--sm btn--ghost-dark"
              onClick={onRetry}
              style={{ marginTop: 'var(--space-3)' }}
            >
              <Icon name="refresh" size={15} />
              Try again
            </button>
          )}
        </Alert>
      )}

      {!loading && !error && slots.length === 0 && (
        <EmptyState
          icon="ban"
          title="No sessions on this day"
          description="There is no availability configured for this date. Try another day on the calendar."
        />
      )}

      {!loading && !error && slots.length > 0 && availableCount === 0 && (
        <Alert tone="warning">
          Every time on this day is taken or has passed. Please choose another date.
        </Alert>
      )}

      {!loading && !error && slots.length > 0 && (
        <>
          {/* Announce the count so a screen-reader user knows the panel changed. */}
          <p className="sr-only" aria-live="polite">
            {availableCount} of {slots.length} times available on {formatDateKey(dateKey)}.
          </p>

          <div className="slots__grid" role="group" aria-label="Choose a time">
            {slots.map((slot) => {
              const key = slot.start.toISOString();
              const selected = selectedStart?.getTime() === slot.start.getTime();
              const reason = slot.reason ? REASON_LABELS[slot.reason] : '';

              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'slot',
                    slot.available ? 'is-available' : 'is-unavailable',
                    selected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!slot.available}
                  aria-pressed={selected}
                  aria-label={
                    slot.available
                      ? `${slot.label}, available`
                      : `${slot.label}, ${reason.toLowerCase()}`
                  }
                  onClick={() => onSelect(slot)}
                >
                  <span className="slot__time">{slot.label}</span>
                  {/* Text label, not just a colour, for the unavailable state. */}
                  {!slot.available && <span className="slot__reason">{reason}</span>}
                  {selected && (
                    <span className="slot__check" aria-hidden="true">
                      <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
