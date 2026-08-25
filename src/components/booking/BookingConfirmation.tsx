import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookingReceipt } from '@/services/bookings';
import type { SiteSettings } from '@/types';
import { downloadIcs } from '@/utils/ics';
import { formatDateKey, formatInstantTime, timeZoneAbbreviation, toDateKey } from '@/utils/time';
import { formatPhone, telHref } from '@/utils/validation';
import { Icon } from '@/components/ui/Icon';

/**
 * Post-booking confirmation.
 *
 * Shows the friendly confirmation code, never the Firestore document ID — an internal
 * address on a public screen invites people to poke at it and reveals how the database
 * is shaped, and it means nothing to the parent anyway.
 */

interface BookingConfirmationProps {
  receipt: BookingReceipt;
  site: SiteSettings;
  onBookAnother: () => void;
}

export function BookingConfirmation({
  receipt,
  site,
  onBookAnother,
}: BookingConfirmationProps) {
  const [copied, setCopied] = useState(false);

  const dateKey = toDateKey(receipt.start, receipt.timezone);
  const zone = timeZoneAbbreviation(receipt.timezone, receipt.start);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(receipt.confirmationCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be denied; the code is on screen regardless, so this
      // is not worth interrupting anyone about.
      setCopied(false);
    }
  };

  const addToCalendar = () => {
    downloadIcs(
      {
        uid: receipt.confirmationCode,
        title: `Math tutoring with ${site.tutorName}`,
        description: [
          `Student: ${receipt.studentName}`,
          `Duration: ${receipt.durationMinutes} minutes`,
          `Confirmation code: ${receipt.confirmationCode}`,
          site.contact.phone ? `Tutor: ${formatPhone(site.contact.phone)}` : '',
          '',
          'To cancel or reschedule, text the number above at least 24 hours ahead.',
        ]
          .filter(Boolean)
          .join('\n'),
        start: receipt.start,
        end: receipt.end,
        ...(site.contact.location ? { location: site.contact.location } : {}),
      },
      `tutoring-${receipt.confirmationCode}.ics`,
    );
  };

  return (
    <div className="confirmation">
      {/* Announced immediately: this is the outcome the whole flow was for. */}
      <div className="confirmation__badge" role="status" aria-live="polite">
        <span className="confirmation__badge-icon">
          <Icon name="check" size={34} strokeWidth={3} />
        </span>
        <h2 className="confirmation__title">Session Scheduled!</h2>
        <p className="confirmation__lead">
          You are booked in. There is nothing else you need to do — here are the details.
        </p>
      </div>

      <div className="confirmation__card">
        <div className="confirmation__code-row">
          <div>
            <p className="confirmation__code-label">Confirmation code</p>
            <p className="confirmation__code">{receipt.confirmationCode}</p>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--ghost-dark"
            onClick={copyCode}
            aria-live="polite"
          >
            <Icon name={copied ? 'check' : 'copy'} size={15} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <dl className="confirmation__details">
          <div className="confirmation__detail confirmation__detail--wide">
            <dt>Date</dt>
            <dd>{formatDateKey(dateKey)}</dd>
          </div>
          <div className="confirmation__detail">
            <dt>Time</dt>
            <dd>
              {formatInstantTime(receipt.start, receipt.timezone)}
              <span className="confirmation__zone"> {zone}</span>
            </dd>
          </div>
          <div className="confirmation__detail">
            <dt>Duration</dt>
            <dd>{receipt.durationMinutes} minutes</dd>
          </div>
          <div className="confirmation__detail">
            <dt>Parent / Guardian</dt>
            <dd>{receipt.parentName}</dd>
          </div>
          <div className="confirmation__detail">
            <dt>Student</dt>
            <dd>{receipt.studentName}</dd>
          </div>
          <div className="confirmation__detail">
            <dt>Phone</dt>
            <dd>{formatPhone(receipt.phone)}</dd>
          </div>
          {receipt.email && (
            <div className="confirmation__detail">
              <dt>Email</dt>
              <dd className="confirmation__wrap">{receipt.email}</dd>
            </div>
          )}
          {receipt.subject && (
            <div className="confirmation__detail">
              <dt>Subject</dt>
              <dd>{receipt.subject}</dd>
            </div>
          )}
        </dl>

        <div className="confirmation__actions">
          <button type="button" className="btn btn--primary" onClick={addToCalendar}>
            <Icon name="calendar" size={18} />
            Add to calendar
          </button>
          {site.contact.phone && (
            <a href={telHref(site.contact.phone)} className="btn btn--ghost-dark">
              <Icon name="phone" size={18} />
              Text {site.tutorName.split(' ')[0]}
            </a>
          )}
        </div>
      </div>

      <div className="confirmation__next">
        <h3 className="confirmation__next-title">
          <Icon name="info" size={18} />
          Need to cancel or reschedule?
        </h3>
        <p>
          Text{' '}
          {site.contact.phone ? (
            <a href={telHref(site.contact.phone)}>{formatPhone(site.contact.phone)}</a>
          ) : (
            'the number on the contact page'
          )}{' '}
          with your confirmation code at least 24 hours before the session. See the{' '}
          <Link to="/cancellation">Cancellation Policy</Link> for the full details.
        </p>
      </div>

      <div className="btn-row btn-row--center confirmation__footer">
        <button type="button" className="btn btn--ghost-dark" onClick={onBookAnother}>
          Book another session
        </button>
        <Link to="/" className="btn btn--ghost-dark">
          Back to home
        </Link>
      </div>
    </div>
  );
}
