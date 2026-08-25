import { useEffect, useState } from 'react';
import type { PricingTier, SellingPoint, SiteSettings, SocialLink } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import { updateSiteSettings } from '@/services/settings';
import { POINT_ICON_NAMES, SOCIAL_ICON_NAMES } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { SelectField, TextAreaField, TextField, ToggleField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { AdminCard, AdminPageHeader, SaveBar, useSaveState } from '../components/AdminUi';
import { PhotoUploader } from '../components/PhotoUploader';

/**
 * Website content editor.
 *
 * One draft object, one save. Editing hero copy and pricing in the same sitting should be
 * one write, not seven — and `updateSiteSettings` merges, so a field this form does not
 * touch is never clobbered.
 */

const uid = () => Math.random().toString(36).slice(2, 10);

/** The keys of `SiteSettings` whose values are nested objects. */
type SectionKey =
  | 'hero'
  | 'about'
  | 'why'
  | 'pricing'
  | 'contact'
  | 'scheduleCta'
  | 'seo'
  | 'footer'
  | 'theme';

export function ContentPage() {
  const { site, refresh } = useSiteContent();
  const save = useSaveState();
  const [draft, setDraft] = useState<SiteSettings>(site);

  useEffect(() => {
    setDraft(site);
  }, [site]);

  /** Immutable nested update — never mutate the draft in place. */
  const patch = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    save.setDirty(true);
  };

  /**
   * Narrowed to the nested-object keys only. `patch` handles the flat string fields;
   * without this split, TypeScript rightly objects to spreading `SiteSettings[K]` when
   * K could be `businessName` (a string).
   */
  const patchSection = <K extends SectionKey>(key: K, changes: Partial<SiteSettings[K]>) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...changes } }));
    save.setDirty(true);
  };

  const handleSave = () => {
    void save.run(
      async () => {
        await updateSiteSettings(draft);
        await refresh();
      },
      'ContentPage.save',
      'Website content saved.',
    );
  };

  /* ---- selling points ---- */

  const updatePoint = (id: string, changes: Partial<SellingPoint>) =>
    patchSection('why', {
      points: draft.why.points.map((point) =>
        point.id === id ? { ...point, ...changes } : point,
      ),
    });

  const movePoint = (index: number, delta: number) => {
    const points = [...draft.why.points];
    const target = index + delta;
    if (target < 0 || target >= points.length) return;
    const a = points[index];
    const b = points[target];
    if (!a || !b) return;
    points[index] = b;
    points[target] = a;
    patchSection('why', { points });
  };

  /* ---- pricing ---- */

  const updateTier = (id: string, changes: Partial<PricingTier>) =>
    patchSection('pricing', {
      tiers: draft.pricing.tiers.map((tier) =>
        tier.id === id ? { ...tier, ...changes } : tier,
      ),
    });

  /* ---- socials ---- */

  const updateSocial = (id: string, changes: Partial<SocialLink>) =>
    patchSection('contact', {
      socials: draft.contact.socials.map((social) =>
        social.id === id ? { ...social, ...changes } : social,
      ),
    });

  return (
    <div className="admin-page admin-page--savebar">
      <AdminPageHeader
        title="Website Content"
        description="Everything visible on the public homepage. Changes go live as soon as you save."
      />

      {/* ---- identity ---- */}
      <AdminCard title="Your name and business" >
        <div className="form-grid form-grid--2">
          <TextField
            label="Business name"
            value={draft.businessName}
            onChange={(event) => patch('businessName', event.target.value)}
            hint="Used in the footer, page titles and the browser tab."
            maxLength={80}
          />
          <TextField
            label="Your name"
            value={draft.tutorName}
            onChange={(event) => patch('tutorName', event.target.value)}
            hint="Shown in the header and About section."
            maxLength={60}
          />
          <TextField
            label="Positioning line"
            value={draft.tagline}
            onChange={(event) => patch('tagline', event.target.value)}
            hint="The short description under your name, e.g. your current studies."
            wrapperClassName="form-grid__full"
            maxLength={140}
          />
        </div>
      </AdminCard>

      {/* ---- hero ---- */}
      <AdminCard title="Hero" description="The first thing a visitor sees.">
        <div className="form-grid form-grid--2">
          <TextField
            label="Eyebrow"
            value={draft.hero.eyebrow}
            onChange={(event) => patchSection('hero', { eyebrow: event.target.value })}
            hint="Small pill above the headline. Leave blank to hide."
            maxLength={60}
          />
          <TextField
            label="Primary button"
            value={draft.hero.primaryCtaLabel}
            onChange={(event) => patchSection('hero', { primaryCtaLabel: event.target.value })}
            maxLength={30}
          />
          <TextField
            label="Headline"
            value={draft.hero.heading}
            onChange={(event) => patchSection('hero', { heading: event.target.value })}
            wrapperClassName="form-grid__full"
            hint="Keep it short — this renders very large."
            maxLength={70}
          />
          <TextAreaField
            label="Subheading"
            value={draft.hero.subheading}
            onChange={(event) => patchSection('hero', { subheading: event.target.value })}
            rows={2}
            wrapperClassName="form-grid__full"
            maxLength={200}
          />
          <TextAreaField
            label="Intro under the photo"
            value={draft.hero.intro}
            onChange={(event) => patchSection('hero', { intro: event.target.value })}
            rows={3}
            wrapperClassName="form-grid__full"
            maxLength={300}
          />
          <TextField
            label="Secondary button"
            value={draft.hero.secondaryCtaLabel}
            onChange={(event) => patchSection('hero', { secondaryCtaLabel: event.target.value })}
            maxLength={30}
          />
        </div>
      </AdminCard>

      {/* ---- photo ---- */}
      <AdminCard
        title="Profile photo"
        description="Shown in the hero and the About section."
      >
        <PhotoUploader
          currentUrl={draft.about.photoUrl}
          currentPath={draft.about.photoStoragePath}
          altText={draft.about.photoAlt}
          onAltChange={(photoAlt) => patchSection('about', { photoAlt })}
          onUploaded={(photoUrl, photoStoragePath) => {
            patchSection('about', { photoUrl, photoStoragePath });
          }}
          onRemoved={() =>
            patchSection('about', { photoUrl: '', photoStoragePath: '' })
          }
        />
      </AdminCard>

      {/* ---- about ---- */}
      <AdminCard title="About" description="Your bio, background and teaching approach.">
        <div className="form-grid">
          <TextField
            label="Section heading"
            value={draft.about.heading}
            onChange={(event) => patchSection('about', { heading: event.target.value })}
            maxLength={60}
          />

          <TextAreaField
            label="Bio"
            value={draft.about.bio}
            onChange={(event) => patchSection('about', { bio: event.target.value })}
            rows={8}
            hint="Leave a blank line between paragraphs. Plain text — no formatting needed."
          />

          <div className="field">
            <span className="field__label">Background / qualifications</span>
            <p className="field__hint">
              One per line. These render as a checklist. Only list things that are
              genuinely true of you — this is the section visitors will trust most.
            </p>
            <textarea
              className="textarea"
              rows={6}
              value={draft.about.qualifications.join('\n')}
              onChange={(event) =>
                patchSection('about', {
                  qualifications: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>

          <TextField
            label="Teaching section heading"
            value={draft.about.teachingPhilosophyHeading}
            onChange={(event) =>
              patchSection('about', { teachingPhilosophyHeading: event.target.value })
            }
            maxLength={60}
          />

          <TextAreaField
            label="Teaching philosophy"
            value={draft.about.teachingPhilosophy}
            onChange={(event) =>
              patchSection('about', { teachingPhilosophy: event.target.value })
            }
            rows={6}
            hint="Leave blank to hide this block entirely."
          />
        </div>
      </AdminCard>

      {/* ---- selling points ---- */}
      <AdminCard
        title="Why tutor with me"
        description="Your selling points. Three to five works best."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--ghost-dark"
            onClick={() =>
              patchSection('why', {
                points: [
                  ...draft.why.points,
                  { id: uid(), title: 'New point', body: '', icon: 'star' },
                ],
              })
            }
          >
            <Icon name="plus" size={15} />
            Add point
          </button>
        }
      >
        <div className="form-grid form-grid--2">
          <TextField
            label="Section heading"
            value={draft.why.heading}
            onChange={(event) => patchSection('why', { heading: event.target.value })}
            maxLength={60}
          />
          <TextField
            label="Section subheading"
            value={draft.why.subheading}
            onChange={(event) => patchSection('why', { subheading: event.target.value })}
            maxLength={140}
          />
        </div>

        <div className="repeatable">
          {draft.why.points.map((point, index) => (
            <div className="repeatable__item" key={point.id}>
              <div className="repeatable__head">
                <span className="repeatable__index">{index + 1}</span>
                <div className="repeatable__controls">
                  <button
                    type="button"
                    onClick={() => movePoint(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move "${point.title}" up`}
                  >
                    <Icon name="chevron-up" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePoint(index, 1)}
                    disabled={index === draft.why.points.length - 1}
                    aria-label={`Move "${point.title}" down`}
                  >
                    <Icon name="chevron-down" size={16} />
                  </button>
                  <button
                    type="button"
                    className="repeatable__delete"
                    onClick={() =>
                      patchSection('why', {
                        points: draft.why.points.filter((p) => p.id !== point.id),
                      })
                    }
                    aria-label={`Delete "${point.title}"`}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              <div className="form-grid form-grid--2">
                <TextField
                  label="Title"
                  value={point.title}
                  onChange={(event) => updatePoint(point.id, { title: event.target.value })}
                  maxLength={60}
                />
                <IconSelect
                  label="Icon"
                  value={point.icon}
                  options={POINT_ICON_NAMES}
                  onChange={(icon) => updatePoint(point.id, { icon })}
                />
                <TextAreaField
                  label="Body"
                  value={point.body}
                  onChange={(event) => updatePoint(point.id, { body: event.target.value })}
                  rows={2}
                  wrapperClassName="form-grid__full"
                  maxLength={280}
                />
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* ---- pricing ---- */}
      <AdminCard
        title="Pricing"
        description="Add more tiers to offer several session lengths."
        actions={
          <button
            type="button"
            className="btn btn--sm btn--ghost-dark"
            onClick={() =>
              patchSection('pricing', {
                tiers: [
                  ...draft.pricing.tiers,
                  {
                    id: uid(),
                    label: 'New session type',
                    durationMinutes: 30,
                    price: 20,
                    description: '',
                    featured: false,
                    visible: true,
                  },
                ],
              })
            }
          >
            <Icon name="plus" size={15} />
            Add tier
          </button>
        }
      >
        <div className="form-grid form-grid--2">
          <TextField
            label="Section heading"
            value={draft.pricing.heading}
            onChange={(event) => patchSection('pricing', { heading: event.target.value })}
            maxLength={60}
          />
          <TextField
            label="Currency symbol"
            value={draft.pricing.currencySymbol}
            onChange={(event) =>
              patchSection('pricing', { currencySymbol: event.target.value })
            }
            maxLength={3}
          />
          <TextField
            label="Section subheading"
            value={draft.pricing.subheading}
            onChange={(event) => patchSection('pricing', { subheading: event.target.value })}
            wrapperClassName="form-grid__full"
            maxLength={160}
          />
          <TextAreaField
            label="Note below the prices"
            value={draft.pricing.note}
            onChange={(event) => patchSection('pricing', { note: event.target.value })}
            rows={2}
            wrapperClassName="form-grid__full"
            maxLength={300}
          />
        </div>

        <Alert tone="info" plain>
          Session lengths offered on the booking page are set separately, under
          Availability. Pricing tiers here are display only — no payment is taken on the
          site.
        </Alert>

        <div className="repeatable">
          {draft.pricing.tiers.map((tier, index) => (
            <div className="repeatable__item" key={tier.id}>
              <div className="repeatable__head">
                <span className="repeatable__index">{index + 1}</span>
                <div className="repeatable__controls">
                  <button
                    type="button"
                    className="repeatable__delete"
                    onClick={() =>
                      patchSection('pricing', {
                        tiers: draft.pricing.tiers.filter((t) => t.id !== tier.id),
                      })
                    }
                    aria-label={`Delete "${tier.label}"`}
                    disabled={draft.pricing.tiers.length === 1}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              <div className="form-grid form-grid--2">
                <TextField
                  label="Label"
                  value={tier.label}
                  onChange={(event) => updateTier(tier.id, { label: event.target.value })}
                  maxLength={40}
                />
                <TextField
                  label="Price"
                  type="number"
                  min={0}
                  value={tier.price}
                  onChange={(event) =>
                    updateTier(tier.id, { price: Number(event.target.value) || 0 })
                  }
                />
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  min={5}
                  step={5}
                  value={tier.durationMinutes}
                  onChange={(event) =>
                    updateTier(tier.id, { durationMinutes: Number(event.target.value) || 60 })
                  }
                />
                <TextAreaField
                  label="Description"
                  value={tier.description}
                  onChange={(event) => updateTier(tier.id, { description: event.target.value })}
                  rows={2}
                  wrapperClassName="form-grid__full"
                  maxLength={220}
                />
              </div>

              <div className="repeatable__toggles">
                <ToggleField
                  label="Show on the website"
                  checked={tier.visible}
                  onChange={(visible) => updateTier(tier.id, { visible })}
                />
                <ToggleField
                  label="Highlight as most popular"
                  hint="Only meaningful with two or more tiers."
                  checked={tier.featured}
                  onChange={(featured) => {
                    // Exactly one tier can be featured; turning one on turns the others off.
                    patchSection('pricing', {
                      tiers: draft.pricing.tiers.map((t) => ({
                        ...t,
                        featured: t.id === tier.id ? featured : false,
                      })),
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* ---- section headings ---- */}
      <AdminCard title="Section headings" description="Titles for the subject and testimonial sections.">
        <div className="form-grid form-grid--2">
          <TextField
            label="Subjects heading"
            value={draft.subjectsHeading}
            onChange={(event) => patch('subjectsHeading', event.target.value)}
            maxLength={60}
          />
          <TextField
            label="Subjects subheading"
            value={draft.subjectsSubheading}
            onChange={(event) => patch('subjectsSubheading', event.target.value)}
            maxLength={140}
          />
          <TextField
            label="Testimonials heading"
            value={draft.testimonialsHeading}
            onChange={(event) => patch('testimonialsHeading', event.target.value)}
            maxLength={60}
          />
          <TextField
            label="Testimonials subheading"
            value={draft.testimonialsSubheading}
            onChange={(event) => patch('testimonialsSubheading', event.target.value)}
            maxLength={140}
          />
        </div>
      </AdminCard>

      {/* ---- schedule CTA ---- */}
      <AdminCard title="Booking call-to-action" description="The band above the contact section.">
        <div className="form-grid form-grid--2">
          <TextField
            label="Heading"
            value={draft.scheduleCta.heading}
            onChange={(event) => patchSection('scheduleCta', { heading: event.target.value })}
            maxLength={70}
          />
          <TextField
            label="Button label"
            value={draft.scheduleCta.buttonLabel}
            onChange={(event) =>
              patchSection('scheduleCta', { buttonLabel: event.target.value })
            }
            maxLength={30}
          />
          <TextAreaField
            label="Subheading"
            value={draft.scheduleCta.subheading}
            onChange={(event) => patchSection('scheduleCta', { subheading: event.target.value })}
            rows={2}
            wrapperClassName="form-grid__full"
            maxLength={200}
          />
        </div>
      </AdminCard>

      {/* ---- contact ---- */}
      <AdminCard
        title="Contact"
        actions={
          <button
            type="button"
            className="btn btn--sm btn--ghost-dark"
            onClick={() =>
              patchSection('contact', {
                socials: [
                  ...draft.contact.socials,
                  { id: uid(), label: 'New link', url: 'https://', icon: 'globe' },
                ],
              })
            }
          >
            <Icon name="plus" size={15} />
            Add link
          </button>
        }
      >
        <div className="form-grid form-grid--2">
          <TextField
            label="Phone number"
            value={draft.contact.phone}
            onChange={(event) => patchSection('contact', { phone: event.target.value })}
            hint="Becomes a tappable link on phones."
            maxLength={20}
          />
          <TextField
            label="Phone button label"
            value={draft.contact.phoneCtaLabel}
            onChange={(event) =>
              patchSection('contact', { phoneCtaLabel: event.target.value })
            }
            maxLength={40}
          />
          <TextField
            label="Email (optional)"
            type="email"
            value={draft.contact.email}
            onChange={(event) => patchSection('contact', { email: event.target.value })}
            hint="Leave blank to hide it everywhere."
            maxLength={120}
          />
          <TextField
            label="Availability line"
            value={draft.contact.location}
            onChange={(event) => patchSection('contact', { location: event.target.value })}
            hint="e.g. Flexible Scheduling, or Online and in person."
            maxLength={60}
          />
          <TextField
            label="Contact heading"
            value={draft.contact.heading}
            onChange={(event) => patchSection('contact', { heading: event.target.value })}
            maxLength={60}
          />
          <TextField
            label="Contact subheading"
            value={draft.contact.subheading}
            onChange={(event) => patchSection('contact', { subheading: event.target.value })}
            maxLength={160}
          />
        </div>

        {draft.contact.socials.length > 0 && (
          <div className="repeatable">
            {draft.contact.socials.map((social) => (
              <div className="repeatable__item" key={social.id}>
                <div className="form-grid form-grid--2">
                  <TextField
                    label="Label"
                    value={social.label}
                    onChange={(event) => updateSocial(social.id, { label: event.target.value })}
                    maxLength={40}
                  />
                  <IconSelect
                    label="Icon"
                    value={social.icon}
                    options={SOCIAL_ICON_NAMES}
                    onChange={(icon) => updateSocial(social.id, { icon })}
                  />
                  <TextField
                    label="URL"
                    type="url"
                    value={social.url}
                    onChange={(event) => updateSocial(social.id, { url: event.target.value })}
                    wrapperClassName="form-grid__full"
                    placeholder="https://"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost-dark"
                  onClick={() =>
                    patchSection('contact', {
                      socials: draft.contact.socials.filter((s) => s.id !== social.id),
                    })
                  }
                >
                  <Icon name="trash" size={15} />
                  Remove link
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* ---- footer & SEO ---- */}
      <AdminCard title="Footer and search listing">
        <div className="form-grid">
          <TextField
            label="Footer tagline"
            value={draft.footer.tagline}
            onChange={(event) => patchSection('footer', { tagline: event.target.value })}
            maxLength={140}
          />
          <TextField
            label="Copyright line"
            value={draft.footer.copyright}
            onChange={(event) => patchSection('footer', { copyright: event.target.value })}
            hint="Use {year} and it is replaced with the current year automatically."
            maxLength={140}
          />
          <TextField
            label="Browser tab / search title"
            value={draft.seo.title}
            onChange={(event) => patchSection('seo', { title: event.target.value })}
            hint="Aim for under 60 characters so search results do not truncate it."
            maxLength={120}
          />
          <TextAreaField
            label="Search description"
            value={draft.seo.description}
            onChange={(event) => patchSection('seo', { description: event.target.value })}
            rows={3}
            hint="Around 150-160 characters is ideal."
            maxLength={300}
          />
          <TextField
            label="Site URL (optional)"
            type="url"
            value={draft.seo.canonicalUrl}
            onChange={(event) => patchSection('seo', { canonicalUrl: event.target.value })}
            hint="Your live address, e.g. https://yourname.github.io/math-tutoring/. Used for canonical and share links."
            placeholder="https://"
          />
          <TextField
            label="Share image URL (optional)"
            type="url"
            value={draft.seo.ogImageUrl}
            onChange={(event) => patchSection('seo', { ogImageUrl: event.target.value })}
            hint="Shown when the site is shared on social media or in messages."
            placeholder="https://"
          />
        </div>
      </AdminCard>

      <SaveBar
        dirty={save.dirty}
        state={save.state}
        message={save.message}
        onSave={handleSave}
        onReset={() => {
          setDraft(site);
          save.setDirty(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IconSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="icon-select">
      <SelectField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectField>
      <span className="icon-select__preview" aria-hidden="true">
        <Icon name={value} size={20} />
      </span>
    </div>
  );
}
