import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookingFormValues, SchedulingSettings, Subject } from '@/types';
import { type FieldErrors, hasErrors, validateBookingForm } from '@/utils/validation';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';

/**
 * The details step.
 *
 * Only three fields are required — parent name, student name, phone — because every extra
 * required field is another reason to abandon a booking. Email, subject and notes are
 * offered because they are genuinely useful, not because the form wants the data.
 *
 * Validation runs on submit, and thereafter on every change for fields that have already
 * errored. Validating an untouched field the moment it is focused-then-blurred just
 * scolds people mid-typing.
 */

const EMPTY: BookingFormValues = {
  parentName: '',
  studentName: '',
  phone: '',
  email: '',
  subject: '',
  notes: '',
  policyAccepted: false,
};

interface BookingFormProps {
  scheduling: SchedulingSettings;
  subjects: Subject[];
  submitting: boolean;
  submitError: string | null;
  onSubmit: (values: BookingFormValues) => void;
  onBack: () => void;
  /** Pre-selects the subject dropdown when arriving from a subject card. */
  initialSubject?: string;
}

export function BookingForm({
  scheduling,
  subjects,
  submitting,
  submitError,
  onSubmit,
  onBack,
  initialSubject = '',
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>({
    ...EMPTY,
    subject: initialSubject,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof BookingFormValues>(
    key: K,
    value: BookingFormValues[K],
  ) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      // Re-validate live only once the user has tried to submit, so errors clear as
      // they are fixed but never appear before they have finished typing.
      if (submitted) setErrors(validateBookingForm(next, scheduling));
      return next;
    });
  };

  // Move focus to the server-error banner so it is announced and reachable.
  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    const nextErrors = validateBookingForm(values, scheduling);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) {
      // Focus the first invalid control rather than leaving people to hunt for it.
      const firstKey = Object.keys(nextErrors)[0];
      const element = document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      element?.focus();
      return;
    }

    onSubmit(values);
  };

  return (
    <form className="booking-form" onSubmit={handleSubmit} noValidate>
      <div className="booking-form__intro">
        <h3 className="booking-form__title">Your details</h3>
        {scheduling.bookingIntro && (
          <p className="booking-form__lead">{scheduling.bookingIntro}</p>
        )}
      </div>

      {submitError && (
        <div ref={errorRef} tabIndex={-1} className="booking-form__server-error">
          <Alert tone="error">{submitError}</Alert>
        </div>
      )}

      <div className="form-grid form-grid--2">
        <TextField
          label="Parent / Guardian Name"
          placeholder="e.g. Dana Rivera"
          value={values.parentName}
          onChange={(event) => update('parentName', event.target.value)}
          error={errors.parentName ?? ''}
          required
          autoComplete="name"
          data-field="parentName"
          maxLength={80}
        />

        <TextField
          label="Student Name"
          placeholder="e.g. Sam"
          value={values.studentName}
          onChange={(event) => update('studentName', event.target.value)}
          error={errors.studentName ?? ''}
          hint="A first name or nickname is fine."
          required
          data-field="studentName"
          maxLength={80}
        />

        <TextField
          label="Phone Number"
          type="tel"
          inputMode="tel"
          placeholder="e.g. (786) 555-1234"
          value={values.phone}
          onChange={(event) => update('phone', event.target.value)}
          error={errors.phone ?? ''}
          hint="Used to confirm the session and reach you if anything changes."
          required
          autoComplete="tel"
          data-field="phone"
          maxLength={20}
        />

        <TextField
          label={`Email${scheduling.requireParentEmail ? '' : ' (optional)'}`}
          type="email"
          inputMode="email"
          placeholder="e.g. dana@example.com"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email ?? ''}
          required={scheduling.requireParentEmail}
          autoComplete="email"
          data-field="email"
          maxLength={120}
        />

        {subjects.length > 0 && (
          <SelectField
            label="Subject (optional)"
            value={values.subject}
            onChange={(event) => update('subject', event.target.value)}
            error={errors.subject ?? ''}
            wrapperClassName="form-grid__full"
            data-field="subject"
          >
            <option value="">No preference / not sure yet</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.name}>
                {subject.name}
              </option>
            ))}
          </SelectField>
        )}

        {scheduling.studentNotesEnabled && (
          <TextAreaField
            label="Anything I should know? (optional)"
            placeholder="e.g. Sam has a test on quadratics next Friday and is stuck on factoring."
            value={values.notes}
            onChange={(event) => update('notes', event.target.value)}
            error={errors.notes ?? ''}
            hint={`${values.notes.length}/800 characters. Please do not include medical, financial or other sensitive information.`}
            wrapperClassName="form-grid__full"
            rows={4}
            data-field="notes"
            maxLength={800}
          />
        )}
      </div>

      {scheduling.privacyNotice && (
        <div className="booking-form__privacy">
          <Icon name="shield" size={18} />
          <p>{scheduling.privacyNotice}</p>
        </div>
      )}

      <div className="booking-form__consent">
        <CheckboxField
          checked={values.policyAccepted}
          onChange={(checked) => update('policyAccepted', checked)}
          error={errors.policyAccepted ?? ''}
          name="policyAccepted"
        >
          I have read and agree to the{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          ,{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/cancellation" target="_blank" rel="noopener noreferrer">
            Cancellation Policy
          </Link>
          . I confirm I am the parent or guardian of the student named above, or that I am
          18 or older and booking for myself.
        </CheckboxField>
      </div>

      <div className="booking-form__actions">
        <button
          type="button"
          className="btn btn--ghost-dark"
          onClick={onBack}
          disabled={submitting}
        >
          <Icon name="arrow-left" size={18} />
          Change time
        </button>

        <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Booking...
            </>
          ) : (
            <>
              <Icon name="check" size={19} strokeWidth={2.5} />
              Confirm booking
            </>
          )}
        </button>
      </div>
    </form>
  );
}
