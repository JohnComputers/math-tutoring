import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AvailabilityException,
  AvailabilityPeriod,
  ExceptionKind,
  IsoDate,
  SchedulingSettings,
  Weekday,
  WeeklyAvailability,
} from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import {
  createException,
  deleteException,
  getUpcomingExceptions,
  pruneExceptionsBefore,
} from '@/services/availability';
import { updateSchedulingSettings } from '@/services/settings';
import { handleError } from '@/utils/errors';
import { SLOT_GRAIN_MINUTES, mergePeriods, resolvePeriodsForDate } from '@/utils/slots';
import {
  WEEKDAY_LABELS,
  addDays,
  formatDateKey,
  formatMinutes,
  isValidDateKey,
  parseTimeInput,
  todayDateKey,
  toTimeInputValue,
} from '@/utils/time';
import { Alert, EmptyState, LoadingPanel } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { SelectField, TextField, ToggleField } from '@/components/ui/Field';
import { AdminCard, AdminPageHeader, SaveBar, useSaveState } from '../components/AdminUi';

/**
 * Weekly availability, session rules, and dated exceptions.
 *
 * The preview at the bottom is the part that earns its keep: availability rules are
 * abstract ("6-8pm, 60-minute sessions, 15-minute buffer") and it is genuinely hard to
 * predict what slots they produce. Running the real `generateSlots` against the pending
 * settings shows the answer before anything is saved.
 */

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function AvailabilityPage() {
  const { scheduling, refresh } = useSiteContent();
  const save = useSaveState();

  const [draft, setDraft] = useState<SchedulingSettings>(scheduling);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loadingExceptions, setLoadingExceptions] = useState(true);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AvailabilityException | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(scheduling);
  }, [scheduling]);

  const todayKey = todayDateKey(scheduling.timezone);

  const loadExceptions = useCallback(async () => {
    setLoadingExceptions(true);
    try {
      setExceptions(await getUpcomingExceptions(addDays(todayKey, -7)));
      setExceptionError(null);
    } catch (caught) {
      setExceptionError(
        handleError('AvailabilityPage.loadExceptions', caught, 'Could not load exceptions.'),
      );
    } finally {
      setLoadingExceptions(false);
    }
  }, [todayKey]);

  useEffect(() => {
    void loadExceptions();
  }, [loadExceptions]);

  /* ---- weekly editing ---- */

  const patch = (changes: Partial<SchedulingSettings>) => {
    setDraft((current) => ({ ...current, ...changes }));
    save.setDirty(true);
  };

  const patchDay = (day: Weekday, changes: Partial<WeeklyAvailability[Weekday]>) => {
    setDraft((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: { ...current.weekly[day], ...changes },
      },
    }));
    save.setDirty(true);
  };

  const setPeriod = (day: Weekday, index: number, changes: Partial<AvailabilityPeriod>) => {
    const periods = [...(draft.weekly[day]?.periods ?? [])];
    const existing = periods[index];
    if (!existing) return;
    periods[index] = { ...existing, ...changes };
    patchDay(day, { periods });
  };

  const addPeriod = (day: Weekday) => {
    const periods = [...(draft.weekly[day]?.periods ?? [])];
    const last = periods[periods.length - 1];
    // Start the new block after the previous one so it does not immediately overlap.
    const start = last ? Math.min(last.end + 60, 22 * 60) : 18 * 60;
    periods.push({ start, end: Math.min(start + 120, 24 * 60) });
    patchDay(day, { periods, enabled: true });
  };

  const removePeriod = (day: Weekday, index: number) => {
    const periods = (draft.weekly[day]?.periods ?? []).filter((_, i) => i !== index);
    patchDay(day, { periods });
  };

  const copyToWeekdays = (source: Weekday) => {
    const template = draft.weekly[source];
    if (!template) return;
    const next = { ...draft.weekly };
    for (const day of [1, 2, 3, 4, 5] as Weekday[]) {
      next[day] = { enabled: template.enabled, periods: template.periods.map((p) => ({ ...p })) };
    }
    setDraft((current) => ({ ...current, weekly: next }));
    save.setDirty(true);
    setNotice('Copied to Monday through Friday. Remember to save.');
  };

  /* ---- validation ---- */

  const validation = useMemo(() => {
    const problems: string[] = [];

    for (const day of WEEKDAYS) {
      const config = draft.weekly[day];
      if (!config?.enabled) continue;
      for (const period of config.periods) {
        if (period.end <= period.start) {
          problems.push(
            `${WEEKDAY_LABELS[day]}: ${formatMinutes(period.start)} to ${formatMinutes(period.end)} ends before it starts.`,
          );
        }
      }
      const merged = mergePeriods(config.periods);
      if (merged.length < config.periods.filter((p) => p.end > p.start).length) {
        problems.push(`${WEEKDAY_LABELS[day]}: some time blocks overlap and will be merged.`);
      }
    }

    if (draft.bufferMinutes % SLOT_GRAIN_MINUTES !== 0) {
      problems.push(`Buffer should be a multiple of ${SLOT_GRAIN_MINUTES} minutes.`);
    }
    if (draft.sessionDurations.some((d) => d % SLOT_GRAIN_MINUTES !== 0)) {
      problems.push(`Session lengths should be multiples of ${SLOT_GRAIN_MINUTES} minutes.`);
    }
    if (!draft.sessionDurations.includes(draft.defaultDurationMinutes)) {
      problems.push('The default session length is not in the list of offered lengths.');
    }
    if (draft.sessionDurations.length === 0) {
      problems.push('At least one session length is required.');
    }

    return problems;
  }, [draft]);

  const handleSave = () => {
    if (validation.some((p) => p.includes('ends before') || p.includes('required') || p.includes('not in the list'))) {
      save.setMessage('Fix the highlighted problems before saving.');
      save.setState('error');
      return;
    }

    void save.run(
      async () => {
        // Normalise on the way in so the stored data is always clean, whatever the
        // form allowed the admin to type.
        const weekly = { ...draft.weekly };
        for (const day of WEEKDAYS) {
          const config = weekly[day];
          if (config) weekly[day] = { ...config, periods: mergePeriods(config.periods) };
        }
        await updateSchedulingSettings({
          ...draft,
          weekly,
          sessionDurations: [...new Set(draft.sessionDurations)].sort((a, b) => a - b),
        });
        await refresh();
      },
      'AvailabilityPage.save',
      'Availability saved.',
    );
  };

  /* ---- preview ---- */

  const preview = useMemo(() => {
    const days: { dateKey: IsoDate; slots: string[] }[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dateKey = addDays(todayKey, offset);
      const periods = resolvePeriodsForDate(dateKey, draft, exceptions);
      const labels: string[] = [];
      for (const period of periods) {
        const step = Math.max(SLOT_GRAIN_MINUTES, draft.defaultDurationMinutes);
        for (
          let minute = period.start;
          minute + draft.defaultDurationMinutes <= period.end;
          minute += step
        ) {
          labels.push(formatMinutes(minute));
        }
      }
      days.push({ dateKey, slots: labels });
    }
    return days;
  }, [draft, exceptions, todayKey]);

  /* ---- exception actions ---- */

  const handleCreateException = async (input: Omit<AvailabilityException, 'id' | 'createdAt'>) => {
    setBusy(true);
    try {
      await createException(input);
      setShowExceptionForm(false);
      setNotice('Exception added.');
      await loadExceptions();
    } catch (caught) {
      setExceptionError(
        handleError('AvailabilityPage.createException', caught, 'Could not add that exception.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteException = async (exception: AvailabilityException) => {
    setBusy(true);
    try {
      await deleteException(exception.id);
      setNotice('Exception removed.');
      await loadExceptions();
    } catch (caught) {
      setExceptionError(
        handleError('AvailabilityPage.deleteException', caught, 'Could not remove that exception.'),
      );
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const upcomingExceptions = exceptions.filter((e) => e.date >= todayKey);
  const staleCount = exceptions.length - upcomingExceptions.length;

  return (
    <div className="admin-page admin-page--savebar">
      <AdminPageHeader
        title="Availability"
        description="When you are open for sessions, and the rules that turn that into bookable slots."
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {validation.length > 0 && (
        <Alert tone="warning">
          <ul className="admin-issues">
            {validation.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* ---- weekly grid ---- */}
      <AdminCard
        title="Weekly schedule"
        description="Your normal week. Add more than one block per day if you have a gap in the middle."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--ghost-dark"
            onClick={() => copyToWeekdays(1)}
            title="Copy Monday's hours to Tuesday through Friday"
          >
            <Icon name="copy" size={15} />
            Copy Mon to weekdays
          </button>
        }
      >
        <div className="weekday-list">
          {WEEKDAYS.map((day) => {
            const config = draft.weekly[day] ?? { enabled: false, periods: [] };
            const isWeekend = day === 0 || day === 6;
            const mutedByWeekendSwitch = isWeekend && !draft.weekendsEnabled;

            return (
              <div
                key={day}
                className={`weekday ${config.enabled ? 'is-on' : ''} ${mutedByWeekendSwitch ? 'is-overridden' : ''}`.trim()}
              >
                <div className="weekday__head">
                  <ToggleField
                    label={WEEKDAY_LABELS[day] ?? ''}
                    checked={config.enabled}
                    onChange={(enabled) => patchDay(day, { enabled })}
                  />
                </div>

                {mutedByWeekendSwitch && (
                  <p className="weekday__override">
                    <Icon name="info" size={14} />
                    Weekends are switched off in Settings, so this day is closed regardless.
                  </p>
                )}

                {config.enabled && (
                  <div className="weekday__periods">
                    {config.periods.length === 0 && (
                      <p className="admin-hint">No hours set — add a time block.</p>
                    )}

                    {config.periods.map((period, index) => (
                      <div className="period-row" key={index}>
                        <label className="period-row__field">
                          <span className="sr-only">
                            {WEEKDAY_LABELS[day]} block {index + 1} start time
                          </span>
                          <input
                            type="time"
                            className="input"
                            step={SLOT_GRAIN_MINUTES * 60}
                            value={toTimeInputValue(period.start)}
                            onChange={(event) => {
                              const minutes = parseTimeInput(event.target.value);
                              if (minutes !== null) setPeriod(day, index, { start: minutes });
                            }}
                          />
                        </label>

                        <span className="period-row__to" aria-hidden="true">
                          to
                        </span>

                        <label className="period-row__field">
                          <span className="sr-only">
                            {WEEKDAY_LABELS[day]} block {index + 1} end time
                          </span>
                          <input
                            type="time"
                            className="input"
                            step={SLOT_GRAIN_MINUTES * 60}
                            value={toTimeInputValue(period.end)}
                            onChange={(event) => {
                              const minutes = parseTimeInput(event.target.value);
                              if (minutes !== null) setPeriod(day, index, { end: minutes });
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          className="period-row__remove"
                          onClick={() => removePeriod(day, index)}
                          aria-label={`Remove ${WEEKDAY_LABELS[day]} block ${index + 1}`}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn btn--sm btn--ghost-dark"
                      onClick={() => addPeriod(day)}
                    >
                      <Icon name="plus" size={15} />
                      Add time block
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AdminCard>

      {/* ---- session rules ---- */}
      <AdminCard
        title="Session rules"
        description="How your open hours are divided into bookable slots."
      >
        <div className="form-grid form-grid--2">
          <TextField
            label="Default session length (minutes)"
            type="number"
            min={SLOT_GRAIN_MINUTES}
            max={480}
            step={SLOT_GRAIN_MINUTES}
            value={draft.defaultDurationMinutes}
            onChange={(event) =>
              patch({ defaultDurationMinutes: Number(event.target.value) || 60 })
            }
            hint="Pre-selected on the booking page."
          />

          <TextField
            label="Offered session lengths"
            value={draft.sessionDurations.join(', ')}
            onChange={(event) =>
              patch({
                sessionDurations: event.target.value
                  .split(',')
                  .map((part) => Number(part.trim()))
                  .filter((n) => Number.isFinite(n) && n > 0),
              })
            }
            hint="Comma separated, e.g. 30, 60, 90. One value hides the length picker."
          />

          <TextField
            label="Buffer between sessions (minutes)"
            type="number"
            min={0}
            max={120}
            step={SLOT_GRAIN_MINUTES}
            value={draft.bufferMinutes}
            onChange={(event) => patch({ bufferMinutes: Number(event.target.value) || 0 })}
            hint="Protected time after each session. A 6:00-7:00 session with a 15-minute buffer blocks 7:00 as a start time."
          />

          <TextField
            label="Minimum notice (minutes)"
            type="number"
            min={0}
            max={20160}
            value={draft.minimumNoticeMinutes}
            onChange={(event) =>
              patch({ minimumNoticeMinutes: Number(event.target.value) || 0 })
            }
            hint={`How far ahead someone must book. ${Math.round(draft.minimumNoticeMinutes / 60)} hours.`}
          />

          <TextField
            label="Book up to (days ahead)"
            type="number"
            min={1}
            max={365}
            value={draft.maximumAdvanceDays}
            onChange={(event) => patch({ maximumAdvanceDays: Number(event.target.value) || 30 })}
            hint="How far into the future the calendar opens."
          />
        </div>
      </AdminCard>

      {/* ---- preview ---- */}
      <AdminCard
        title="Preview: the next 7 days"
        description="What these settings actually produce, exceptions included. Already-booked times are not reflected here."
      >
        <div className="preview-week">
          {preview.map((day) => (
            <div key={day.dateKey} className="preview-day">
              <p className="preview-day__label">{formatDateKey(day.dateKey, true).replace(/,.*$/, '')}</p>
              <p className="preview-day__date">{formatDateKey(day.dateKey, false)}</p>
              {day.slots.length === 0 ? (
                <p className="preview-day__closed">Closed</p>
              ) : (
                <ul className="preview-day__slots">
                  {day.slots.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </AdminCard>

      {/* ---- exceptions ---- */}
      <AdminCard
        title="Date exceptions"
        description="One-off changes that override the weekly schedule — holidays, competitions, extra hours."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setShowExceptionForm(true)}
          >
            <Icon name="plus" size={15} />
            Add exception
          </button>
        }
      >
        {exceptionError && <Alert tone="error">{exceptionError}</Alert>}

        {loadingExceptions ? (
          <LoadingPanel message="Loading exceptions..." />
        ) : upcomingExceptions.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No exceptions"
            description="Your weekly schedule applies to every date."
          />
        ) : (
          <ul className="exception-list">
            {upcomingExceptions.map((exception) => (
              <li key={exception.id} className="exception-row">
                <div className="exception-row__main">
                  <p className="exception-row__date">{formatDateKey(exception.date)}</p>
                  <p className="exception-row__what">
                    <span className={`exception-tag exception-tag--${exception.kind}`}>
                      {exception.kind === 'blockAll'
                        ? 'Closed all day'
                        : exception.kind === 'replace'
                          ? 'Replaces normal hours'
                          : 'Extra hours'}
                    </span>
                    {exception.kind !== 'blockAll' &&
                      exception.periods
                        .map((p) => `${formatMinutes(p.start)}-${formatMinutes(p.end)}`)
                        .join(', ')}
                  </p>
                  {exception.reason && (
                    <p className="exception-row__reason">{exception.reason}</p>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn--sm btn--ghost-dark"
                  onClick={() => setDeleteTarget(exception)}
                >
                  <Icon name="trash" size={15} />
                  <span className="sr-only">Remove exception for {formatDateKey(exception.date)}</span>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {staleCount > 0 && (
          <div className="exception-list__prune">
            <p className="admin-hint">
              {staleCount} exception{staleCount === 1 ? '' : 's'} for dates that have passed.
            </p>
            <button
              type="button"
              className="btn btn--sm btn--ghost-dark"
              disabled={busy}
              onClick={() =>
                void pruneExceptionsBefore(todayKey)
                  .then((count) => {
                    setNotice(`Cleared ${count} past exception${count === 1 ? '' : 's'}.`);
                    return loadExceptions();
                  })
                  .catch((caught: unknown) =>
                    setExceptionError(
                      handleError('AvailabilityPage.prune', caught, 'Could not clear those.'),
                    ),
                  )
              }
            >
              Clear past exceptions
            </button>
          </div>
        )}
      </AdminCard>

      <SaveBar
        dirty={save.dirty}
        state={save.state}
        message={save.message}
        onSave={handleSave}
        onReset={() => {
          setDraft(scheduling);
          save.setDirty(false);
        }}
      />

      {showExceptionForm && (
        <ExceptionForm
          timezone={scheduling.timezone}
          busy={busy}
          onClose={() => setShowExceptionForm(false)}
          onSubmit={handleCreateException}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this exception?"
        destructive
        busy={busy}
        confirmLabel="Remove"
        message={
          deleteTarget
            ? `${formatDateKey(deleteTarget.date)} will go back to following your normal weekly schedule.`
            : ''
        }
        onConfirm={() => deleteTarget && void handleDeleteException(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExceptionForm({
  timezone,
  busy,
  onClose,
  onSubmit,
}: {
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<AvailabilityException, 'id' | 'createdAt'>) => void;
}) {
  const [date, setDate] = useState<IsoDate>(todayDateKey(timezone));
  const [kind, setKind] = useState<ExceptionKind>('blockAll');
  const [start, setStart] = useState(18 * 60);
  const [end, setEnd] = useState(20 * 60);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!isValidDateKey(date)) {
      setError('Please choose a valid date.');
      return;
    }
    if (kind !== 'blockAll' && end <= start) {
      setError('The end time must be after the start time.');
      return;
    }
    setError(null);
    onSubmit({
      date,
      kind,
      periods: kind === 'blockAll' ? [] : [{ start, end }],
      reason: reason.trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a date exception"
      description="Overrides your weekly schedule for one specific date."
      footer={
        <div className="btn-row modal__actions">
          <button type="button" className="btn btn--ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Add exception
          </button>
        </div>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="form-grid">
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <SelectField
          label="What happens on this date"
          value={kind}
          onChange={(event) => setKind(event.target.value as ExceptionKind)}
        >
          <option value="blockAll">Closed all day</option>
          <option value="replace">Different hours than usual</option>
          <option value="add">Extra hours on top of usual</option>
        </SelectField>

        {kind !== 'blockAll' && (
          <div className="period-row period-row--modal">
            <label className="period-row__field">
              <span className="field__label">From</span>
              <input
                type="time"
                className="input"
                step={SLOT_GRAIN_MINUTES * 60}
                value={toTimeInputValue(start)}
                onChange={(event) => {
                  const minutes = parseTimeInput(event.target.value);
                  if (minutes !== null) setStart(minutes);
                }}
              />
            </label>
            <label className="period-row__field">
              <span className="field__label">To</span>
              <input
                type="time"
                className="input"
                step={SLOT_GRAIN_MINUTES * 60}
                value={toTimeInputValue(end)}
                onChange={(event) => {
                  const minutes = parseTimeInput(event.target.value);
                  if (minutes !== null) setEnd(minutes);
                }}
              />
            </label>
          </div>
        )}

        <TextField
          label="Note (optional)"
          placeholder="e.g. Regional math competition"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="For your reference only — this is never shown on the website. Keep it non-sensitive: the value is technically readable by the public site even though nothing displays it."
          maxLength={120}
        />
      </div>
    </Modal>
  );
}
