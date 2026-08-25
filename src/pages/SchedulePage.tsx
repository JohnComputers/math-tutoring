import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { AvailabilityException, BookingFormValues, IsoDate, TimeSlot } from '@/types';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useMediaQuery } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { getExceptions } from '@/services/availability';
import { type BookingReceipt, createBooking, getOccupiedGrains } from '@/services/bookings';
import { generateSlots } from '@/utils/slots';
import { SlotTakenError, ValidationError, handleError } from '@/utils/errors';
import { addDays, formatDateKey, formatMinutes, todayDateKey } from '@/utils/time';
import { DatePicker } from '@/components/booking/DatePicker';
import { TimeSlots } from '@/components/booking/TimeSlots';
import { BookingForm } from '@/components/booking/BookingForm';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { Alert, LoadingPanel } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import '@/styles/booking.css';

/**
 * The scheduling page: pick a date, pick a time, enter details, done.
 *
 * Three steps, not four, and no account — the target is a parent booking from a phone in
 * under two minutes.
 *
 * The interesting case is the race. Two people can be looking at the same 6:00 PM slot;
 * only one write can win. When `createBooking` throws `SlotTakenError`, this drops back
 * to the time step, reloads the real availability, and says plainly what happened. That
 * path is not an edge case to tolerate — it is the one the whole grain-lock design exists
 * to make correct.
 */

type Step = 'select' | 'details' | 'done';

export function SchedulePage() {
  const { site, scheduling, subjects, loading: contentLoading, configured } = useSiteContent();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 940px)');

  const [step, setStep] = useState<Step>('select');
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState<number>(scheduling.defaultDurationMinutes);

  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [exceptionsLoaded, setExceptionsLoaded] = useState(false);
  const [occupiedGrains, setOccupiedGrains] = useState<Set<number>>(new Set());

  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);

  const slotsPanelRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useDocumentMeta({
    title: `Schedule a Session | ${site.businessName}`,
    description: `Book a one-on-one math tutoring session with ${site.tutorName}. Choose a date and time that works for you.`,
    ...(site.seo.canonicalUrl ? { canonicalUrl: `${site.seo.canonicalUrl.replace(/\/$/, '')}/#/schedule` } : {}),
  });

  // Keep the duration in step with the settings once they load.
  useEffect(() => {
    setDuration(scheduling.defaultDurationMinutes);
  }, [scheduling.defaultDurationMinutes]);

  /**
   * Start a fresh booking when the user navigates to this page again.
   *
   * Router navigation to the same path does not remount the component, so after booking,
   * clicking "Schedule" in the header would otherwise leave the confirmation screen up —
   * a dead end for anyone wanting to book a second session. `location.key` changes on
   * every navigation even when the path does not, which is what distinguishes "arrived
   * here again" from a re-render.
   *
   * Only resets from the confirmation screen: someone half-way through the form should
   * never lose what they typed.
   */
  const stepRef = useRef<Step>(step);
  stepRef.current = step;

  useEffect(() => {
    if (stepRef.current !== 'done') return;
    setStep('select');
    setReceipt(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setSlotsError(null);
  }, [location.key]);

  /* ---- exceptions: fetched once for the whole bookable window ---- */
  useEffect(() => {
    if (!configured) return;
    let active = true;

    const from = todayDateKey(scheduling.timezone);
    const to = addDays(from, scheduling.maximumAdvanceDays + 1);

    void getExceptions(from, to)
      .then((result) => {
        if (!active) return;
        setExceptions(result);
      })
      .finally(() => {
        if (active) setExceptionsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [configured, scheduling.timezone, scheduling.maximumAdvanceDays]);

  /* ---- reservations for the selected date ---- */
  const loadOccupied = useCallback(
    async (dateKey: IsoDate) => {
      setSlotsLoading(true);
      setSlotsError(null);
      try {
        const grains = await getOccupiedGrains(dateKey, scheduling);
        setOccupiedGrains(grains);
      } catch (error) {
        setSlotsError(
          handleError(
            'SchedulePage.loadOccupied',
            error,
            'Could not check which times are still free. Please try again.',
          ),
        );
        // Empty on failure would render every slot as bookable, which is worse than
        // showing an error: it invites a booking that will be rejected on submit.
        setOccupiedGrains(new Set());
      } finally {
        setSlotsLoading(false);
      }
    },
    [scheduling],
  );

  useEffect(() => {
    if (!selectedDate || !configured) return;
    void loadOccupied(selectedDate);
  }, [selectedDate, configured, loadOccupied]);

  /* ---- derived slots ---- */
  const slots = useMemo(() => {
    if (!selectedDate) return [];
    return generateSlots({
      dateKey: selectedDate,
      scheduling,
      exceptions,
      occupiedGrains,
      durationMinutes: duration,
    });
  }, [selectedDate, scheduling, exceptions, occupiedGrains, duration]);

  /* ---- handlers ---- */

  const handleSelectDate = (dateKey: IsoDate) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setSubmitError(null);

    // On phones the slot panel sits below the fold; bring it into view so the next
    // step is not hidden under the calendar the user just tapped.
    if (!isDesktop) {
      window.setTimeout(() => {
        slotsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setSubmitError(null);
  };

  const goToDetails = () => {
    if (!selectedSlot) return;
    setStep('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => stepHeadingRef.current?.focus(), 220);
  };

  const handleSubmit = async (values: BookingFormValues) => {
    if (!selectedSlot || !selectedDate) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createBooking({
        start: selectedSlot.start,
        durationMinutes: duration,
        values,
        scheduling,
        tutorName: site.tutorName,
      });
      setReceipt(result);
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof SlotTakenError) {
        // Somebody else committed first. Go back, refresh, and be honest about it.
        setSubmitError(null);
        setSelectedSlot(null);
        setStep('select');
        await loadOccupied(selectedDate);
        setSlotsError(
          'Sorry — that time was booked by someone else while you were filling in the form. The times below are up to date. Please pick another.',
        );
        window.setTimeout(() => {
          slotsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } else if (error instanceof ValidationError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          handleError(
            'SchedulePage.handleSubmit',
            error,
            'Could not complete the booking. Please try again, or text to book directly.',
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('select');
    setSelectedSlot(null);
    setReceipt(null);
    setSubmitError(null);
    setSlotsError(null);
    if (selectedDate) void loadOccupied(selectedDate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---- render ---- */

  if (!configured) {
    return (
      <section className="section section--light">
        <div className="container container--narrow">
          <Alert tone="warning">
            <p>
              <strong>Scheduling is not connected yet.</strong>
            </p>
            <p style={{ marginTop: 'var(--space-2)' }}>
              This site has no Firebase configuration, so bookings cannot be saved. See the
              README for setup instructions.
            </p>
          </Alert>
        </div>
      </section>
    );
  }

  if (contentLoading || !exceptionsLoaded) {
    return (
      <section className="section section--light">
        <div className="container">
          <LoadingPanel message="Loading the schedule..." />
        </div>
      </section>
    );
  }

  if (step === 'done' && receipt) {
    return (
      <section className="section section--light booking-page">
        <MathBackground variant="light" density="sparse" />
        <div className="container container--narrow booking-page__inner">
          <BookingConfirmation receipt={receipt} site={site} onBookAnother={reset} />
        </div>
      </section>
    );
  }

  const durations = scheduling.sessionDurations.length
    ? scheduling.sessionDurations
    : [scheduling.defaultDurationMinutes];

  return (
    <section className="section section--light booking-page">
      <MathBackground variant="light" density="sparse" />

      <div className="container booking-page__inner">
        <header className="booking-page__head">
          <p className="eyebrow">
            <Icon name="calendar" size={14} />
            Schedule
          </p>
          <h1 className="section-title" ref={stepHeadingRef} tabIndex={-1}>
            {step === 'select' ? 'Book a session' : 'Almost done'}
          </h1>
          <p className="section-subtitle">
            {step === 'select'
              ? 'Pick a date, choose a time, and tell me a little about your student.'
              : 'Just your details, then the session is confirmed.'}
          </p>
        </header>

        {/* Progress: also a live region, so the current step is announced. */}
        <ol className="booking-steps" aria-label="Booking progress">
          {(['Date & time', 'Your details', 'Confirmed'] as const).map((label, index) => {
            const stepIndex = step === 'select' ? 0 : step === 'details' ? 1 : 2;
            const state =
              index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : '';
            return (
              <li key={label} className={`booking-steps__item ${state}`.trim()}>
                <span className="booking-steps__marker" aria-hidden="true">
                  {index < stepIndex ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}
                </span>
                <span className="booking-steps__label">{label}</span>
                {index === stepIndex && <span className="sr-only">(current step)</span>}
              </li>
            );
          })}
        </ol>

        {step === 'select' && (
          <>
            {durations.length > 1 && (
              <div className="duration-picker">
                <span className="duration-picker__label" id="duration-label">
                  Session length
                </span>
                <div
                  className="duration-picker__options"
                  role="group"
                  aria-labelledby="duration-label"
                >
                  {durations.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={`duration-option ${duration === minutes ? 'is-selected' : ''}`.trim()}
                      aria-pressed={duration === minutes}
                      onClick={() => {
                        setDuration(minutes);
                        setSelectedSlot(null);
                      }}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="booking-layout">
              <div className="booking-layout__calendar">
                <DatePicker
                  scheduling={scheduling}
                  exceptions={exceptions}
                  selectedDate={selectedDate}
                  onSelect={handleSelectDate}
                />
              </div>

              <div className="booking-layout__slots" ref={slotsPanelRef}>
                <TimeSlots
                  dateKey={selectedDate}
                  slots={slots}
                  selectedStart={selectedSlot?.start ?? null}
                  onSelect={handleSelectSlot}
                  loading={slotsLoading}
                  error={slotsError}
                  scheduling={scheduling}
                  onRetry={selectedDate ? () => void loadOccupied(selectedDate) : undefined}
                />
              </div>
            </div>

            {/* Sticky continue bar: on a phone the chosen slot may have scrolled away,
                so the confirmation of what is selected travels with the button. */}
            {selectedSlot && selectedDate && (
              <div className="booking-continue">
                <div className="booking-continue__summary">
                  <Icon name="check-circle" size={18} />
                  <span>
                    <strong>{formatDateKey(selectedDate, false)}</strong> at{' '}
                    <strong>{formatMinutes(selectedSlot.minutesOfDay)}</strong> · {duration} min
                  </span>
                </div>
                <button type="button" className="btn btn--primary" onClick={goToDetails}>
                  Continue
                  <Icon name="arrow-right" size={18} />
                </button>
              </div>
            )}
          </>
        )}

        {step === 'details' && selectedSlot && selectedDate && (
          <div className="booking-details">
            <aside className="booking-summary" aria-label="Selected session">
              <h2 className="booking-summary__title">Your session</h2>
              <dl className="booking-summary__list">
                <div>
                  <dt>Date</dt>
                  <dd>{formatDateKey(selectedDate)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatMinutes(selectedSlot.minutesOfDay)}</dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>{duration} minutes</dd>
                </div>
              </dl>
            </aside>

            <BookingForm
              scheduling={scheduling}
              subjects={subjects}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmit}
              onBack={() => setStep('select')}
              initialSubject={searchParams.get('subject') ?? ''}
            />
          </div>
        )}
      </div>
    </section>
  );
}
