import { useEffect, useState } from 'react';
import type { LegalSettings } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import { updateLegalSettings } from '@/services/settings';
import { DEFAULT_LEGAL } from '@/services/defaults';
import { Icon } from '@/components/ui/Icon';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { RichText } from '@/components/ui/RichText';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  AdminCard,
  AdminPageHeader,
  LegalDisclaimer,
  SaveBar,
  useSaveState,
} from '../components/AdminUi';

/**
 * Policy document editor with a live preview.
 *
 * The preview matters here more than anywhere else: these documents use the markdown-lite
 * syntax, and someone editing a privacy policy should be able to see that their heading
 * actually became a heading before it goes live on a page people are asked to agree to.
 */

type DocKey = keyof Omit<LegalSettings, 'updatedAt'>;

const TABS: { key: DocKey; label: string; note: string }[] = [
  {
    key: 'privacy',
    label: 'Privacy Policy',
    note: 'What you collect, why, where it is stored, and how someone asks for it to be deleted.',
  },
  {
    key: 'terms',
    label: 'Terms of Service',
    note: 'The rules for using the site and booking sessions.',
  },
  {
    key: 'cancellation',
    label: 'Cancellation Policy',
    note: 'Your actual rules for cancelling and rescheduling. Make this match how you really operate.',
  },
  {
    key: 'guardian',
    label: 'Parent & Guardian Notice',
    note: 'Who is responsible for arranging sessions for a student under 18.',
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    note: 'What the site does for assistive technology, and how to report a problem.',
  },
];

export function LegalAdminPage() {
  const { legal, refresh } = useSiteContent();
  const save = useSaveState();

  const [draft, setDraft] = useState<LegalSettings>(legal);
  const [active, setActive] = useState<DocKey>('privacy');
  const [preview, setPreview] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DocKey | null>(null);

  useEffect(() => {
    setDraft(legal);
  }, [legal]);

  const current = draft[active];
  const activeTab = TABS.find((tab) => tab.key === active);

  const patch = (changes: Partial<LegalSettings[DocKey]>) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [active]: { ...currentDraft[active], ...changes },
    }));
    save.setDirty(true);
  };

  const handleSave = () => {
    void save.run(
      async () => {
        await updateLegalSettings(draft);
        await refresh();
      },
      'LegalAdminPage.save',
      'Policies saved.',
    );
  };

  return (
    <div className="admin-page admin-page--savebar">
      <AdminPageHeader
        title="Legal & Policies"
        description="The five policy pages linked in the footer and from the booking form."
      />

      <LegalDisclaimer />

      <div className="legal-tabs" role="tablist" aria-label="Policy documents">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`legal-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`legal-panel-${tab.key}`}
            className={`legal-tab ${active === tab.key ? 'is-active' : ''}`.trim()}
            onClick={() => {
              setActive(tab.key);
              setPreview(false);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AdminCard
        id={`legal-panel-${active}`}
        title={activeTab?.label}
        description={activeTab?.note}
        actions={
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--sm btn--ghost-dark"
              onClick={() => setPreview((shown) => !shown)}
              aria-pressed={preview}
            >
              <Icon name={preview ? 'pencil' : 'eye'} size={15} />
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost-dark"
              onClick={() => setRestoreTarget(active)}
            >
              <Icon name="refresh" size={15} />
              Restore template
            </button>
          </div>
        }
      >
        {preview ? (
          <div className="legal-preview">
            <h2 className="legal-preview__title">{current.title}</h2>
            {current.lastUpdated && (
              <p className="legal-preview__updated">Last updated: {current.lastUpdated}</p>
            )}
            <RichText content={current.body} />
          </div>
        ) : (
          <div className="form-grid">
            <div className="form-grid form-grid--2">
              <TextField
                label="Page title"
                value={current.title}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={80}
              />
              <TextField
                label="Last updated"
                value={current.lastUpdated}
                onChange={(event) => patch({ lastUpdated: event.target.value })}
                placeholder="e.g. August 2026"
                hint="Update this whenever you change the text."
                maxLength={40}
              />
            </div>

            <TextAreaField
              label="Content"
              value={current.body}
              onChange={(event) => patch({ body: event.target.value })}
              rows={26}
              className="legal-editor"
              hint={
                'Formatting: "## " for a heading, "### " for a sub-heading, "- " for bullets, "---" for a divider, **bold**, *italic*. Leave a blank line between paragraphs.'
              }
            />
          </div>
        )}
      </AdminCard>

      <AdminCard title="Before you publish">
        <ul className="admin-checklist">
          <li>
            <Icon name="check" size={16} />
            Read each policy through as if you were a parent seeing it for the first time.
          </li>
          <li>
            <Icon name="check" size={16} />
            Make the cancellation policy match how you actually handle late cancellations —
            a policy you do not follow is worse than none.
          </li>
          <li>
            <Icon name="check" size={16} />
            Check the Privacy Policy still describes what you really collect if you change
            the booking form.
          </li>
          <li>
            <Icon name="check" size={16} />
            Remove anything that does not apply to you, and add anything specific to how
            you work.
          </li>
          <li>
            <Icon name="check" size={16} />
            Do not claim certifications, insurance or legal compliance you do not have.
          </li>
        </ul>

        <Alert tone="info" plain>
          These templates avoid naming specific laws or claiming compliance with them,
          because a static site cannot guarantee that. If you operate somewhere with
          specific requirements — or you start taking payments, working with schools, or
          serving students outside the US — get a qualified lawyer to review them.
        </Alert>
      </AdminCard>

      <SaveBar
        dirty={save.dirty}
        state={save.state}
        message={save.message}
        onSave={handleSave}
        onReset={() => {
          setDraft(legal);
          save.setDirty(false);
        }}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        title="Restore the original template?"
        destructive
        confirmLabel="Restore template"
        message={
          restoreTarget
            ? `This replaces your edited "${TABS.find((t) => t.key === restoreTarget)?.label}" with the shipped starter text. Nothing is saved until you press Save, so you can still discard it.`
            : ''
        }
        onConfirm={() => {
          if (!restoreTarget) return;
          setDraft((currentDraft) => ({
            ...currentDraft,
            [restoreTarget]: { ...DEFAULT_LEGAL[restoreTarget] },
          }));
          save.setDirty(true);
          setRestoreTarget(null);
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}
