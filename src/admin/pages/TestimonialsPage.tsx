import { useCallback, useEffect, useState } from 'react';
import type { Testimonial } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import {
  createTestimonial,
  deleteTestimonial,
  getTestimonials,
  reorderTestimonials,
  updateTestimonial,
} from '@/services/testimonials';
import { handleError } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { SelectField, TextAreaField, TextField, ToggleField } from '@/components/ui/Field';
import { Alert, EmptyState, LoadingPanel } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { AdminCard, AdminPageHeader } from '../components/AdminUi';

/**
 * Testimonials.
 *
 * Empty by default, and the section does not render on the public site until something
 * visible exists here — an MVP that ships with invented quotes is lying to visitors.
 *
 * The author field is labelled and hinted to keep student names off the public site,
 * which is what the Privacy Policy commits to.
 */

export function TestimonialsPage() {
  const { refresh } = useSiteContent();

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTestimonials(await getTestimonials(true));
      setError(null);
    } catch (caught) {
      setError(handleError('TestimonialsPage.load', caught, 'Could not load testimonials.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, context: string, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setNotice(message);
      await load();
      await refresh();
    } catch (caught) {
      setError(handleError(context, caught, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: number) => {
    const next = [...testimonials];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    setTestimonials(next);
    void run(
      () => reorderTestimonials(next.map((t) => t.id)),
      'TestimonialsPage.reorder',
      'Order updated.',
    );
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Testimonials"
        description="Optional. The section is hidden on the website until at least one is visible."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setEditing('new')}
          >
            <Icon name="plus" size={15} />
            Add testimonial
          </button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <AdminCard>
        <Alert tone="warning" plain>
          <p>
            <strong>Please do not publish student names.</strong>
          </p>
          <p style={{ marginTop: 'var(--space-2)' }}>
            Use a display name such as &ldquo;A parent in Miami&rdquo; or &ldquo;Parent of
            an Algebra 1 student&rdquo;. The Privacy Policy on this site promises that
            student names are never published, and families reasonably expect that. Get
            permission before quoting anyone.
          </p>
        </Alert>
      </AdminCard>

      {loading ? (
        <LoadingPanel message="Loading testimonials..." />
      ) : testimonials.length === 0 ? (
        <EmptyState
          icon="quote"
          title="No testimonials yet"
          description="Add one once a family has offered feedback and agreed to it being quoted."
        />
      ) : (
        <ul className="admin-list">
          {testimonials.map((testimonial, index) => (
            <li key={testimonial.id}>
              <div className={`admin-row ${testimonial.visible ? '' : 'is-hidden'}`.trim()}>
                <span className="admin-row__icon">
                  <Icon name="quote" size={20} />
                </span>

                <div className="admin-row__main">
                  <p className="admin-row__title">
                    {testimonial.author || <span className="muted">Unnamed</span>}
                    {testimonial.rating > 0 && (
                      <span className="chip chip--neutral">{testimonial.rating}/5</span>
                    )}
                    {!testimonial.visible && <span className="chip chip--neutral">Hidden</span>}
                  </p>
                  <p className="admin-row__sub">{testimonial.quote}</p>
                </div>

                <div className="admin-row__actions">
                  <button
                    type="button"
                    className="admin-row__icon-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy}
                    aria-label="Move up"
                  >
                    <Icon name="chevron-up" size={17} />
                  </button>
                  <button
                    type="button"
                    className="admin-row__icon-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === testimonials.length - 1 || busy}
                    aria-label="Move down"
                  >
                    <Icon name="chevron-down" size={17} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost-dark"
                    onClick={() => setEditing(testimonial)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-row__icon-btn admin-row__icon-btn--danger"
                    onClick={() => setDeleteTarget(testimonial)}
                    aria-label="Delete"
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TestimonialForm
          testimonial={
            editing === 'new'
              ? {
                  author: '',
                  relationship: '',
                  quote: '',
                  rating: 5,
                  order: testimonials.length,
                  visible: true,
                }
              : editing
          }
          isNew={editing === 'new'}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const action =
              editing === 'new'
                ? () => createTestimonial(values).then(() => undefined)
                : () => updateTestimonial(editing.id, values);
            void run(
              action,
              'TestimonialsPage.save',
              editing === 'new' ? 'Testimonial added.' : 'Testimonial updated.',
            ).then(() => setEditing(null));
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this testimonial?"
        destructive
        busy={busy}
        confirmLabel="Delete"
        message="This cannot be undone."
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          setDeleteTarget(null);
          void run(
            () => deleteTestimonial(target.id),
            'TestimonialsPage.delete',
            'Testimonial deleted.',
          );
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TestimonialForm({
  testimonial,
  isNew,
  busy,
  onClose,
  onSubmit,
}: {
  testimonial: Omit<Testimonial, 'id' | 'createdAt'>;
  isNew: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<Testimonial, 'id' | 'createdAt'>) => void;
}) {
  const [values, setValues] = useState(testimonial);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (!values.quote.trim()) {
      setError('A testimonial needs a quote.');
      return;
    }
    if (!values.author.trim()) {
      setError('Please give a display name for the person quoted.');
      return;
    }
    setError(null);
    onSubmit({
      ...values,
      author: values.author.trim(),
      quote: values.quote.trim(),
      relationship: values.relationship.trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add a testimonial' : 'Edit testimonial'}
      footer={
        <div className="btn-row modal__actions">
          <button type="button" className="btn btn--ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {isNew ? 'Add' : 'Save changes'}
          </button>
        </div>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="form-grid">
        <TextAreaField
          label="Quote"
          value={values.quote}
          onChange={(event) => update('quote', event.target.value)}
          rows={4}
          required
          maxLength={500}
        />

        <TextField
          label="Display name"
          value={values.author}
          onChange={(event) => update('author', event.target.value)}
          placeholder="e.g. A parent in Miami"
          hint="Not a student's name. A first name and initial, or a general description, is safer."
          required
          maxLength={60}
        />

        <TextField
          label="Relationship (optional)"
          value={values.relationship}
          onChange={(event) => update('relationship', event.target.value)}
          placeholder="e.g. Parent of an Algebra 1 student"
          maxLength={80}
        />

        <SelectField
          label="Rating"
          value={String(values.rating)}
          onChange={(event) => update('rating', Number(event.target.value))}
        >
          <option value="0">No rating shown</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </SelectField>

        <ToggleField
          label="Show on the website"
          checked={values.visible}
          onChange={(visible) => update('visible', visible)}
        />
      </div>
    </Modal>
  );
}
