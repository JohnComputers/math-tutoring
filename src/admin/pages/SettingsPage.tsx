import { useEffect, useState } from 'react';
import type { SchedulingSettings, SiteSettings } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useSiteContent } from '@/hooks/useSiteContent';
import { releaseOrphanedLocks } from '@/services/bookings';
import { updateSchedulingSettings, updateSiteSettings } from '@/services/settings';
import { handleError } from '@/utils/errors';
import { browserTimeZone, isValidTimeZone, timeZoneAbbreviation, todayDateKey } from '@/utils/time';
import { Icon } from '@/components/ui/Icon';
import { SelectField, TextAreaField, TextField, ToggleField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { AdminCard, AdminPageHeader, SaveBar, useSaveState } from '../components/AdminUi';

/**
 * Timezone, booking-form toggles, theme colours, and housekeeping.
 *
 * The timezone is the setting with the widest blast radius: everything the scheduler does
 * is anchored to it, so it gets validation and a plain-language preview rather than a bare
 * text box.
 */

const COMMON_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'UTC',
];

export function SettingsPage() {
  const { site, scheduling, refresh } = useSiteContent();
  const { user } = useAuth();
  const save = useSaveState();

  const [draftScheduling, setDraftScheduling] = useState<SchedulingSettings>(scheduling);
  const [draftTheme, setDraftTheme] = useState<SiteSettings['theme']>(site.theme);
  const [customZone, setCustomZone] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  useEffect(() => {
    setDraftScheduling(scheduling);
  }, [scheduling]);

  useEffect(() => {
    setDraftTheme(site.theme);
  }, [site.theme]);

  const patch = (changes: Partial<SchedulingSettings>) => {
    setDraftScheduling((current) => ({ ...current, ...changes }));
    save.setDirty(true);
  };

  const patchTheme = (changes: Partial<SiteSettings['theme']>) => {
    setDraftTheme((current) => ({ ...current, ...changes }));
    save.setDirty(true);
  };

  const zoneValid = isValidTimeZone(draftScheduling.timezone);

  const handleSave = () => {
    if (!zoneValid) {
      save.setState('error');
      save.setMessage('That timezone is not recognised. Pick one from the list.');
      return;
    }
    void save.run(
      async () => {
        await updateSchedulingSettings(draftScheduling);
        await updateSiteSettings({ theme: draftTheme });
        await refresh();
      },
      'SettingsPage.save',
      'Settings saved.',
    );
  };

  const releaseOrphans = async () => {
    setMaintenanceBusy(true);
    setMaintenanceMessage(null);
    try {
      const released = await releaseOrphanedLocks(
        todayDateKey(scheduling.timezone),
        scheduling,
      );
      setMaintenanceMessage(
        released === 0
          ? 'Nothing to release — every reserved slot belongs to a live booking.'
          : `Released ${released} orphaned slot reservation${released === 1 ? '' : 's'}.`,
      );
    } catch (caught) {
      setMaintenanceMessage(
        handleError('SettingsPage.releaseOrphans', caught, 'Could not run that check.'),
      );
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const detected = browserTimeZone();

  return (
    <div className="admin-page admin-page--savebar">
      <AdminPageHeader
        title="Settings"
        description="Timezone, booking options and site appearance."
      />

      {/* ---- timezone ---- */}
      <AdminCard
        title="Timezone"
        description="Every date and time on the site is shown in this zone."
      >
        <div className="form-grid">
          <SelectField
            label="Timezone"
            value={COMMON_ZONES.includes(draftScheduling.timezone) ? draftScheduling.timezone : 'custom'}
            onChange={(event) => {
              if (event.target.value === 'custom') {
                setCustomZone(draftScheduling.timezone);
              } else {
                patch({ timezone: event.target.value });
              }
            }}
            error={zoneValid ? '' : 'Not a recognised IANA timezone.'}
          >
            {COMMON_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
            <option value="custom">Other (type it in)…</option>
          </SelectField>

          {!COMMON_ZONES.includes(draftScheduling.timezone) && (
            <TextField
              label="Custom IANA timezone"
              value={customZone || draftScheduling.timezone}
              onChange={(event) => {
                setCustomZone(event.target.value);
                patch({ timezone: event.target.value.trim() });
              }}
              placeholder="e.g. Europe/Lisbon"
              hint="Must be a full IANA identifier. Daylight saving is handled automatically — never use a fixed offset like UTC-5."
              error={zoneValid ? '' : 'Not recognised.'}
            />
          )}

          {zoneValid && (
            <Alert tone="info" plain>
              Currently <strong>{timeZoneAbbreviation(draftScheduling.timezone)}</strong>.
              Daylight saving transitions are handled for you.
              {detected !== draftScheduling.timezone && (
                <> This device is in {detected}.</>
              )}
            </Alert>
          )}
        </div>
      </AdminCard>

      {/* ---- booking options ---- */}
      <AdminCard title="Booking options" description="What the public booking form asks for.">
        <ToggleField
          label="Allow weekend bookings"
          hint="A master switch over Saturday and Sunday. When off, both are closed no matter what the weekly schedule says."
          checked={draftScheduling.weekendsEnabled}
          onChange={(weekendsEnabled) => patch({ weekendsEnabled })}
        />
        <ToggleField
          label="Allow same-day bookings"
          hint="When off, the earliest bookable date is tomorrow."
          checked={draftScheduling.allowSameDayBookings}
          onChange={(allowSameDayBookings) => patch({ allowSameDayBookings })}
        />
        <ToggleField
          label="Require an email address"
          hint="Off by default — every required field is another reason to abandon a booking. Phone is always required."
          checked={draftScheduling.requireParentEmail}
          onChange={(requireParentEmail) => patch({ requireParentEmail })}
        />
        <ToggleField
          label="Show the notes field"
          hint="Lets parents mention what their student is working on."
          checked={draftScheduling.studentNotesEnabled}
          onChange={(studentNotesEnabled) => patch({ studentNotesEnabled })}
        />

        <div className="form-grid" style={{ marginTop: 'var(--space-5)' }}>
          <TextAreaField
            label="Intro above the booking form"
            value={draftScheduling.bookingIntro}
            onChange={(event) => patch({ bookingIntro: event.target.value })}
            rows={2}
            maxLength={300}
          />
          <TextAreaField
            label="Privacy note beside the form"
            value={draftScheduling.privacyNotice}
            onChange={(event) => patch({ privacyNotice: event.target.value })}
            rows={3}
            hint="Reassures parents about how the student's name is used. Keep it consistent with your Privacy Policy."
            maxLength={400}
          />
        </div>
      </AdminCard>

      {/* ---- theme ---- */}
      <AdminCard
        title="Colours"
        description="The five brand colours. Everything else on the site is derived from them."
      >
        <div className="theme-grid">
          {(
            [
              ['primary', 'Primary (dark red)'],
              ['cream', 'Cream / yellow'],
              ['coral', 'Coral accent'],
              ['light', 'Light background'],
              ['dark', 'Dark text'],
            ] as const
          ).map(([key, label]) => (
            <div className="theme-swatch" key={key}>
              <label className="field__label" htmlFor={`theme-${key}`}>
                {label}
              </label>
              <div className="theme-swatch__row">
                <input
                  id={`theme-${key}`}
                  type="color"
                  className="theme-swatch__picker"
                  value={draftTheme[key]}
                  onChange={(event) => patchTheme({ [key]: event.target.value })}
                />
                <input
                  type="text"
                  className="input theme-swatch__hex"
                  value={draftTheme[key]}
                  onChange={(event) => patchTheme({ [key]: event.target.value })}
                  aria-label={`${label} hex value`}
                  maxLength={9}
                />
              </div>
            </div>
          ))}
        </div>

        <Alert tone="warning" plain>
          Check contrast after changing these. Cream text on the dark red is what keeps the
          site readable — a lighter primary or a darker cream can quietly push body text
          below the accessibility threshold.
        </Alert>

        <button
          type="button"
          className="btn btn--sm btn--ghost-dark"
          onClick={() => {
            patchTheme({
              primary: '#662720',
              cream: '#F6DF91',
              coral: '#B4472F',
              light: '#F4F1EA',
              dark: '#2B1B18',
            });
          }}
        >
          <Icon name="refresh" size={15} />
          Reset to the original palette
        </button>
      </AdminCard>

      {/* ---- maintenance ---- */}
      <AdminCard
        title="Maintenance"
        description="Occasional housekeeping. You will rarely need these."
      >
        {maintenanceMessage && <Alert tone="info">{maintenanceMessage}</Alert>}

        <p className="admin-hint">
          Every booking reserves the slices of time it occupies, and releases them when it
          is cancelled or completed. If a browser is closed at exactly the wrong moment,
          a reservation can in principle be left behind with no booking attached — which
          would make a slot look permanently taken. This finds and clears any such
          leftovers from today onwards.
        </p>

        <button
          type="button"
          className="btn btn--ghost-dark"
          onClick={() => void releaseOrphans()}
          disabled={maintenanceBusy}
        >
          {maintenanceBusy && <span className="spinner" aria-hidden="true" />}
          <Icon name="refresh" size={17} />
          Release orphaned slots
        </button>
      </AdminCard>

      {/* ---- account ---- */}
      <AdminCard title="Your account">
        <dl className="booking-detail__grid">
          <div className="booking-detail__item">
            <dt>Signed in as</dt>
            <dd>{user?.email}</dd>
          </div>
          <div className="booking-detail__item">
            <dt>Account ID</dt>
            <dd>
              <code className="admin-uid">{user?.uid}</code>
            </dd>
          </div>
        </dl>
        <p className="admin-hint">
          To add another admin, run <code>npm run setup:admin</code> from the project
          folder. Admin access is granted by a server-side script with a service-account
          key, never from inside this dashboard — which is why nobody can promote
          themselves by signing up.
        </p>
      </AdminCard>

      <SaveBar
        dirty={save.dirty}
        state={save.state}
        message={save.message}
        onSave={handleSave}
        onReset={() => {
          setDraftScheduling(scheduling);
          setDraftTheme(site.theme);
          save.setDirty(false);
        }}
      />
    </div>
  );
}
