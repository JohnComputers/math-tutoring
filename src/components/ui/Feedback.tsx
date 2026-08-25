import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Small presentational primitives: alerts, spinners, skeletons, empty states.
 *
 * Alerts announce themselves. `role="alert"` on errors interrupts a screen reader
 * immediately, which is right for "that slot was just taken"; successes use
 * `role="status"`, which waits politely for a pause.
 */

type AlertTone = 'error' | 'success' | 'warning' | 'info';

const ALERT_ICONS: Record<AlertTone, string> = {
  error: 'info',
  success: 'check-circle',
  warning: 'info',
  info: 'info',
};

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
  /** Suppress the icon when the alert sits inside a tight layout. */
  plain?: boolean;
}

export function Alert({ tone = 'info', children, className = '', plain }: AlertProps) {
  return (
    <div
      className={`alert alert--${tone} ${className}`.trim()}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {!plain && <Icon name={ALERT_ICONS[tone]} size={18} />}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ large, label }: { large?: boolean; label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className={large ? 'spinner spinner--lg' : 'spinner'} />
      <span className="sr-only">{label ?? 'Loading'}</span>
    </span>
  );
}

/** Full-panel loading state with a visible message. */
export function LoadingPanel({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="spinner spinner--lg" />
      <p className="loading-panel__text">{message}</p>
    </div>
  );
}

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  dark?: boolean;
  radius?: string;
}

export function Skeleton({ width, height = '1rem', className = '', dark, radius }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${dark ? 'skeleton--dark' : ''} ${className}`.trim()}
      style={{
        width: width ?? '100%',
        height,
        display: 'block',
        ...(radius ? { borderRadius: radius } : {}),
      }}
      aria-hidden="true"
    />
  );
}

/** Several skeleton lines, for paragraph placeholders. */
export function SkeletonText({ lines = 3, dark }: { lines?: number; dark?: boolean }) {
  return (
    <div className="skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          dark={dark}
          height="0.85rem"
          // Ragged last line reads as text rather than a solid block.
          width={index === lines - 1 ? '62%' : '100%'}
        />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = 'info', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <div className="empty-state__body">{description}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
