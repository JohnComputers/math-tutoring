import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Booking } from '@/types';
import { useSiteContent } from '@/hooks/useSiteContent';
import { getUpcomingBookings } from '@/services/bookings';
import { seedSettingsIfMissing } from '@/services/settings';
import { seedSubjectsIfEmpty } from '@/services/subjects';
import { handleError } from '@/utils/errors';
import { addDays, formatDateKey, formatInstantTime, todayDateKey } from '@/utils/time';
import { formatPhone, telHref } from '@/utils/validation';
import { Alert, EmptyState, LoadingPanel } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { AdminCard, AdminPageHeader, StatTile, StatusPill } from '../components/AdminUi';

/**
 * Dashboard: what is happening today, this week, and next.
 *
 * One query does the work — upcoming confirmed bookings — and the tiles are derived from
 * it in memory. Firing four separate count queries would cost four round trips to show
 * four numbers that all come from the same set.
 */
export function DashboardPage() {
  const { site, scheduling, refresh } = useSiteContent();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const todayKey = todayDateKey(scheduling.timezone);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBookings(await getUpcomingBookings(todayKey, 150));
    } catch (caught) {
      setError(handleError('DashboardPage.load', caught, 'Could not load bookings.'));
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const weekEnd = addDays(todayKey, 7);
    return {
      today: bookings.filter((b) => b.dateKey === todayKey).length,
      week: bookings.filter((b) => b.dateKey >= todayKey && b.dateKey < weekEnd).length,
      upcoming: bookings.length,
      nextUp: bookings[0] ?? null,
    };
  }, [bookings, todayKey]);

  const todaysSessions = bookings.filter((b) => b.dateKey === todayKey);
  const nextSessions = bookings.filter((b) => b.dateKey > todayKey).slice(0, 6);

  const runSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const seededSettings = await seedSettingsIfMissing();
      const seededSubjects = await seedSubjectsIfEmpty();
      const parts: string[] = [];
      if (seededSettings.length) parts.push(`${seededSettings.length} settings document(s)`);
      if (seededSubjects) parts.push(`${seededSubjects} subjects`);
      setSeedMessage(
        parts.length
          ? `Created ${parts.join(' and ')}. Existing content was left untouched.`
          : 'Everything is already set up — nothing needed creating.',
      );
      await refresh();
    } catch (caught) {
      setSeedMessage(handleError('DashboardPage.seed', caught, 'Could not seed content.'));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Dashboard"
        description={`Today is ${formatDateKey(todayKey)}.`}
        actions={
          <button type="button" className="btn btn--sm btn--ghost-dark" onClick={() => void load()}>
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {seedMessage && <Alert tone="info">{seedMessage}</Alert>}

      {loading ? (
        <LoadingPanel message="Loading your schedule..." />
      ) : (
        <>
          <div className="stat-grid">
            <StatTile label="Sessions today" value={stats.today} icon="clock" />
            <StatTile label="Next 7 days" value={stats.week} icon="calendar-days" />
            <StatTile label="Upcoming total" value={stats.upcoming} icon="check-circle" />
            <StatTile
              label="Next session"
              value={
                stats.nextUp
                  ? formatInstantTime(stats.nextUp.startAt.toDate(), scheduling.timezone)
                  : '—'
              }
              icon="calendar"
              {...(stats.nextUp ? { hint: formatDateKey(stats.nextUp.dateKey, false) } : {})}
            />
          </div>

          <AdminCard
            title="Today"
            description={
              todaysSessions.length
                ? `${todaysSessions.length} session${todaysSessions.length === 1 ? '' : 's'} scheduled.`
                : undefined
            }
          >
            {todaysSessions.length === 0 ? (
              <EmptyState
                icon="clock"
                title="Nothing scheduled today"
                description="Enjoy the evening off."
              />
            ) : (
              <ul className="session-list">
                {todaysSessions.map((booking) => (
                  <SessionRow key={booking.id} booking={booking} timezone={scheduling.timezone} />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Coming up"
            actions={
              <Link to="/admin/bookings" className="btn btn--sm btn--ghost-dark">
                All bookings
                <Icon name="arrow-right" size={15} />
              </Link>
            }
          >
            {nextSessions.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No upcoming sessions yet"
                description="New bookings from the website will appear here automatically."
              />
            ) : (
              <ul className="session-list">
                {nextSessions.map((booking) => (
                  <SessionRow
                    key={booking.id}
                    booking={booking}
                    timezone={scheduling.timezone}
                    showDate
                  />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="First-time setup"
            description="Only needed once, on a brand-new Firebase project."
          >
            <p className="admin-hint">
              Writes the default site content, scheduling rules, policy documents and the
              starter subjects into Firestore. Anything that already exists is left
              exactly as it is, so this is safe to run more than once.
            </p>
            <button
              type="button"
              className="btn btn--ghost-dark"
              onClick={() => void runSeed()}
              disabled={seeding}
            >
              {seeding && <span className="spinner" aria-hidden="true" />}
              <Icon name="download" size={17} />
              Seed default content
            </button>
          </AdminCard>

          <p className="admin-footnote">
            Signed in to {site.businessName}. Times shown in {scheduling.timezone}.
          </p>
        </>
      )}
    </div>
  );
}

function SessionRow({
  booking,
  timezone,
  showDate,
}: {
  booking: Booking;
  timezone: string;
  showDate?: boolean;
}) {
  const start = booking.startAt?.toDate?.() ?? new Date();

  return (
    <li className="session-row">
      <div className="session-row__time">
        <span className="session-row__hour">{formatInstantTime(start, timezone)}</span>
        {showDate && (
          <span className="session-row__date">{formatDateKey(booking.dateKey, false)}</span>
        )}
        <span className="session-row__duration">{booking.durationMinutes} min</span>
      </div>

      <div className="session-row__who">
        <p className="session-row__student">{booking.studentName}</p>
        <p className="session-row__parent">
          {booking.parentName}
          {booking.subject ? ` · ${booking.subject}` : ''}
        </p>
      </div>

      <div className="session-row__meta">
        <StatusPill status={booking.status} />
        {booking.phone && (
          <a href={telHref(booking.phone)} className="session-row__phone">
            <Icon name="phone" size={14} />
            {formatPhone(booking.phone)}
          </a>
        )}
      </div>
    </li>
  );
}
