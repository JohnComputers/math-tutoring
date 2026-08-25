import { useMemo, useState } from 'react';
import type { AvailabilityException, IsoDate, SchedulingSettings } from '@/types';
import { monthGrid, summariseDay } from '@/utils/slots';
import {
  WEEKDAY_INITIALS,
  WEEKDAY_SHORT,
  addDays,
  daysBetween,
  formatDateKey,
  parseDateKey,
  todayDateKey,
} from '@/utils/time';
import { Icon } from '@/components/ui/Icon';

/**
 * Month calendar for choosing a date.
 *
 * Availability is communicated three ways — a dot, a background, and the button's
 * `aria-label` — never by colour alone, so it survives colour blindness and screen
 * readers equally.
 *
 * Unavailable days are rendered `disabled`, so they cannot be clicked or focused. That
 * is deliberate: a day that looks tappable and then does nothing reads as a broken site.
 */

interface DatePickerProps {
  scheduling: SchedulingSettings;
  exceptions: AvailabilityException[];
  selectedDate: IsoDate | null;
  onSelect: (dateKey: IsoDate) => void;
  now?: Date;
}

export function DatePicker({
  scheduling,
  exceptions,
  selectedDate,
  onSelect,
  now = new Date(),
}: DatePickerProps) {
  const todayKey = todayDateKey(scheduling.timezone, now);
  const today = parseDateKey(todayKey);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ? parseDateKey(selectedDate) : today;
    return { year: base.year, month: base.month };
  });

  const lastBookableKey = addDays(todayKey, scheduling.maximumAdvanceDays);

  const days = useMemo(() => {
    return monthGrid(viewMonth.year, viewMonth.month).map((dateKey) => {
      const summary = summariseDay(dateKey, scheduling, exceptions, now);
      const { month } = parseDateKey(dateKey);
      return {
        ...summary,
        dayNumber: parseDateKey(dateKey).day,
        inMonth: month === viewMonth.month,
      };
    });
  }, [viewMonth, scheduling, exceptions, now]);

  // Disable the arrows rather than letting people wander into months that can hold
  // nothing bookable.
  const canGoBack = useMemo(() => {
    const firstOfView = `${viewMonth.year}-${String(viewMonth.month).padStart(2, '0')}-01`;
    return daysBetween(todayKey, firstOfView) > 0;
  }, [viewMonth, todayKey]);

  const canGoForward = useMemo(() => {
    const firstOfView = `${viewMonth.year}-${String(viewMonth.month).padStart(2, '0')}-01`;
    const firstOfNext = addDays(firstOfView, 32);
    return daysBetween(firstOfNext, lastBookableKey) > -32;
  }, [viewMonth, lastBookableKey]);

  const shiftMonth = (delta: number) => {
    setViewMonth((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  };

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, 15)));

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button
          type="button"
          className="calendar__nav"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <Icon name="chevron-left" size={20} />
        </button>

        {/* aria-live so a screen reader announces the month after the arrows are used. */}
        <h3 className="calendar__month" aria-live="polite">
          {monthLabel}
        </h3>

        <button
          type="button"
          className="calendar__nav"
          onClick={() => shiftMonth(1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>

      <div className="calendar__weekdays" aria-hidden="true">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={WEEKDAY_SHORT[index]} className="calendar__weekday">
            {initial}
          </span>
        ))}
      </div>

      <div className="calendar__grid" role="group" aria-label="Choose a date">
        {days.map((day) => {
          const selected = day.dateKey === selectedDate;
          const disabled = !day.hasAvailability;

          const state = day.isPast
            ? 'in the past'
            : day.isBeyondWindow
              ? 'too far ahead to book'
              : disabled
                ? 'no availability'
                : 'available';

          return (
            <button
              key={day.dateKey}
              type="button"
              className={[
                'calendar__day',
                day.inMonth ? '' : 'is-outside',
                selected ? 'is-selected' : '',
                day.isToday ? 'is-today' : '',
                disabled ? 'is-disabled' : 'is-available',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${formatDateKey(day.dateKey)} — ${state}`}
              onClick={() => onSelect(day.dateKey)}
            >
              <span className="calendar__day-number">{day.dayNumber}</span>
              {/* Second, non-colour signal that the day can be booked. */}
              {!disabled && <span className="calendar__day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <ul className="calendar__legend">
        <li>
          <span className="calendar__legend-swatch calendar__legend-swatch--open" aria-hidden="true" />
          Available
        </li>
        <li>
          <span className="calendar__legend-swatch calendar__legend-swatch--closed" aria-hidden="true" />
          Unavailable
        </li>
        <li>
          <span className="calendar__legend-swatch calendar__legend-swatch--today" aria-hidden="true" />
          Today
        </li>
      </ul>
    </div>
  );
}
