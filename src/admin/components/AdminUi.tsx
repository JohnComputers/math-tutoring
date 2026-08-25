import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { handleError } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/components/ui/Feedback';

/** Shared building blocks for the admin screens. */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <div>
        <h1 className="admin-page-title">{title}</h1>
        {description && <p className="admin-page-desc">{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}

export function AdminCard({
  title,
  description,
  children,
  actions,
  id,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <section className="admin-card" id={id}>
      {(title || actions) && (
        <div className="admin-card__head">
          <div>
            {title && <h2 className="admin-card__title">{title}</h2>}
            {description && <p className="admin-card__desc">{description}</p>}
          </div>
          {actions && <div className="admin-card__actions">{actions}</div>}
        </div>
      )}
      <div className="admin-card__body">{children}</div>
    </section>
  );
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Save-state machine shared by every editor screen.
 *
 * Keeps a `dirty` flag so the save bar only appears when there is something to save, and
 * clears the "Saved" confirmation after a few seconds so it does not linger and make a
 * later unsaved change look already-persisted.
 */
export function useSaveState() {
  const [state, setState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const run = useCallback(
    async (action: () => Promise<void>, context: string, successMessage = 'Saved.') => {
      setState('saving');
      setMessage(null);
      try {
        await action();
        setState('saved');
        setMessage(successMessage);
        setDirty(false);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setState('idle');
          setMessage(null);
        }, 3500);
      } catch (error) {
        setState('error');
        setMessage(handleError(context, error, 'Could not save. Please try again.'));
      }
    },
    [],
  );

  return { state, message, dirty, setDirty, run, setMessage, setState };
}

/**
 * Sticky save bar.
 *
 * Sits at the bottom of the viewport so a long content form never requires scrolling
 * back to the top to save — which on a phone is most of the form.
 */
export function SaveBar({
  dirty,
  state,
  message,
  onSave,
  onReset,
  saveLabel = 'Save changes',
}: {
  dirty: boolean;
  state: SaveState;
  message: string | null;
  onSave: () => void;
  onReset?: () => void;
  saveLabel?: string;
}) {
  // Show while there are unsaved changes, and briefly afterwards to confirm.
  const visible = dirty || state === 'saving' || state === 'saved' || state === 'error';
  if (!visible) return null;

  return (
    <div className="admin-savebar" role="status" aria-live="polite">
      <div className="admin-savebar__message">
        {state === 'saved' && <Icon name="check-circle" size={18} />}
        {state === 'error' && <Icon name="info" size={18} />}
        <span>
          {state === 'saving'
            ? 'Saving...'
            : state === 'saved'
              ? (message ?? 'Saved.')
              : state === 'error'
                ? (message ?? 'Could not save.')
                : 'You have unsaved changes.'}
        </span>
      </div>

      <div className="admin-savebar__actions">
        {onReset && dirty && state !== 'saving' && (
          <button type="button" className="btn btn--sm btn--ghost-light" onClick={onReset}>
            Discard
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm btn--cream"
          onClick={onSave}
          disabled={state === 'saving' || !dirty}
        >
          {state === 'saving' && <span className="spinner" aria-hidden="true" />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'confirmed'
      ? 'confirmed'
      : status === 'completed'
        ? 'completed'
        : status === 'cancelled'
          ? 'cancelled'
          : 'noshow';

  const label =
    status === 'confirmed'
      ? 'Confirmed'
      : status === 'completed'
        ? 'Completed'
        : status === 'cancelled'
          ? 'Cancelled'
          : 'No-show';

  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}

/** Metric tile for the dashboard. */
export function StatTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: string;
  hint?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="stat-tile__text">
        <p className="stat-tile__value">{value}</p>
        <p className="stat-tile__label">{label}</p>
        {hint && <p className="stat-tile__hint">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Advisory shown at the top of the Legal editor.
 *
 * Required by honesty as much as anything: these are useful starting templates, not
 * legal advice, and the person publishing them should know that before they rely on them.
 */
export function LegalDisclaimer() {
  return (
    <Alert tone="info">
      <p>
        <strong>These are starter templates, not legal advice.</strong>
      </p>
      <p style={{ marginTop: 'var(--space-2)' }}>
        They cover what a small tutoring service collecting parent and student details
        would normally need to disclose, but they have not been reviewed for your
        jurisdiction or your specific circumstances. Read them through, make them match
        how you actually operate, and if anything about your situation is unusual — you
        work with schools, take payments online, or operate outside the US — have a
        qualified lawyer look them over before you rely on them.
      </p>
    </Alert>
  );
}
