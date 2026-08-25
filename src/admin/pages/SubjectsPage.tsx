import { useCallback, useEffect, useState } from 'react';
import type { Subject } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import {
  createSubject,
  deleteSubject,
  getSubjects,
  reorderSubjects,
  updateSubject,
} from '@/services/subjects';
import { handleError } from '@/utils/errors';
import { SUBJECT_ICON_NAMES } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { SelectField, TextAreaField, TextField, ToggleField } from '@/components/ui/Field';
import { Alert, EmptyState, LoadingPanel } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { AdminPageHeader } from '../components/AdminUi';

/**
 * Subject cards management.
 *
 * Each subject saves individually rather than through one page-wide save: they are
 * separate documents, and batching them would mean rewriting four unchanged documents to
 * fix a typo in one.
 *
 * Reordering uses buttons rather than drag-and-drop. Drag is nicer with a mouse and
 * miserable on a touchscreen, and this dashboard is meant to work from a phone.
 */

const EMPTY_SUBJECT: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  icon: 'calculator',
  gradeRange: '',
  priceLabel: '',
  order: 0,
  visible: true,
};

export function SubjectsPage() {
  const { refresh } = useSiteContent();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubjects(await getSubjects(true));
      setError(null);
    } catch (caught) {
      setError(handleError('SubjectsPage.load', caught, 'Could not load subjects.'));
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
    const next = [...subjects];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    setSubjects(next);
    void run(
      () => reorderSubjects(next.map((s) => s.id)),
      'SubjectsPage.reorder',
      'Order updated.',
    );
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Subjects"
        description="The cards under “What I Tutor”. Add as many as you like."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setEditing('new')}
          >
            <Icon name="plus" size={15} />
            Add subject
          </button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {loading ? (
        <LoadingPanel message="Loading subjects..." />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon="book"
          title="No subjects yet"
          description="Add your first subject, or run “Seed default content” on the dashboard to start from the four defaults."
          action={
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
              Add a subject
            </button>
          }
        />
      ) : (
        <ul className="admin-list">
          {subjects.map((subject, index) => (
            <li key={subject.id}>
              <div className={`admin-row ${subject.visible ? '' : 'is-hidden'}`.trim()}>
                <span className="admin-row__icon">
                  <Icon name={subject.icon} size={20} />
                </span>

                <div className="admin-row__main">
                  <p className="admin-row__title">
                    {subject.name || <span className="muted">Untitled</span>}
                    {!subject.visible && <span className="chip chip--neutral">Hidden</span>}
                  </p>
                  <p className="admin-row__sub">
                    {subject.gradeRange && <>{subject.gradeRange} · </>}
                    {subject.description || 'No description'}
                  </p>
                </div>

                <div className="admin-row__actions">
                  <button
                    type="button"
                    className="admin-row__icon-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy}
                    aria-label={`Move ${subject.name} up`}
                  >
                    <Icon name="chevron-up" size={17} />
                  </button>
                  <button
                    type="button"
                    className="admin-row__icon-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === subjects.length - 1 || busy}
                    aria-label={`Move ${subject.name} down`}
                  >
                    <Icon name="chevron-down" size={17} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost-dark"
                    onClick={() => setEditing(subject)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-row__icon-btn admin-row__icon-btn--danger"
                    onClick={() => setDeleteTarget(subject)}
                    aria-label={`Delete ${subject.name}`}
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
        <SubjectForm
          subject={editing === 'new' ? { ...EMPTY_SUBJECT, order: subjects.length } : editing}
          isNew={editing === 'new'}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const action =
              editing === 'new'
                ? () => createSubject(values).then(() => undefined)
                : () => updateSubject(editing.id, values);
            void run(
              action,
              'SubjectsPage.save',
              editing === 'new' ? 'Subject added.' : 'Subject updated.',
            ).then(() => setEditing(null));
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this subject?"
        destructive
        busy={busy}
        confirmLabel="Delete"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the website. Bookings that mention it are unaffected. If you only want to hide it for now, edit it and switch off “Show on website” instead.`
            : ''
        }
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          setDeleteTarget(null);
          void run(() => deleteSubject(target.id), 'SubjectsPage.delete', 'Subject deleted.');
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SubjectForm({
  subject,
  isNew,
  busy,
  onClose,
  onSubmit,
}: {
  subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
  isNew: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [values, setValues] = useState({
    name: subject.name,
    description: subject.description,
    icon: subject.icon,
    gradeRange: subject.gradeRange,
    priceLabel: subject.priceLabel,
    order: subject.order,
    visible: subject.visible,
  });
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (!values.name.trim()) {
      setError('A subject needs a name.');
      return;
    }
    setError(null);
    onSubmit({ ...values, name: values.name.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add a subject' : `Edit ${subject.name}`}
      footer={
        <div className="btn-row modal__actions">
          <button type="button" className="btn btn--ghost-dark" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {isNew ? 'Add subject' : 'Save changes'}
          </button>
        </div>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="form-grid">
        <TextField
          label="Name"
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="e.g. Precalculus"
          required
          maxLength={60}
        />

        <TextAreaField
          label="Description"
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
          rows={3}
          hint="One or two sentences on what this covers and where students usually struggle."
          maxLength={280}
        />

        <div className="icon-select">
          <SelectField
            label="Icon"
            value={values.icon}
            onChange={(event) => update('icon', event.target.value)}
          >
            {SUBJECT_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>
          <span className="icon-select__preview" aria-hidden="true">
            <Icon name={values.icon} size={20} />
          </span>
        </div>

        <TextField
          label="Grade range (optional)"
          value={values.gradeRange}
          onChange={(event) => update('gradeRange', event.target.value)}
          placeholder="e.g. Grades 9-10"
          hint="Leave blank to hide the badge."
          maxLength={30}
        />

        <TextField
          label="Price note (optional)"
          value={values.priceLabel}
          onChange={(event) => update('priceLabel', event.target.value)}
          placeholder="e.g. $35/hour"
          hint="Only for subjects priced differently from your standard rate. Leave blank otherwise."
          maxLength={40}
        />

        <ToggleField
          label="Show on the website"
          hint="Switch off to keep a subject without displaying it."
          checked={values.visible}
          onChange={(visible) => update('visible', visible)}
        />
      </div>
    </Modal>
  );
}
