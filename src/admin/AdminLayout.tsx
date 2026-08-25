import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useScrollLock } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Modal';

/**
 * Admin chrome: a sidebar on desktop, a slide-out drawer on phones.
 *
 * The dashboard is genuinely mobile-first too — the most common real use is checking
 * tomorrow's sessions or blocking a date while away from a computer, so nothing here
 * requires a wide screen.
 */

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: 'calendar-days' },
  { to: '/admin/availability', label: 'Availability', icon: 'clock' },
  { to: '/admin/content', label: 'Website Content', icon: 'pencil' },
  { to: '/admin/subjects', label: 'Subjects', icon: 'book' },
  { to: '/admin/testimonials', label: 'Testimonials', icon: 'quote' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/legal', label: 'Legal', icon: 'file-text' },
] as const;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { site } = useSiteContent();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useScrollLock(navOpen);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>

      <header className="admin-topbar">
        <button
          type="button"
          className="admin-topbar__menu"
          aria-expanded={navOpen}
          aria-controls="admin-nav"
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setNavOpen((open) => !open)}
        >
          <Icon name={navOpen ? 'x' : 'menu'} size={22} />
        </button>

        <Link to="/admin" className="admin-topbar__brand">
          <span className="admin-topbar__mark" aria-hidden="true">
            <Icon name="sigma" size={17} strokeWidth={2.5} />
          </span>
          <span className="admin-topbar__title">Admin</span>
        </Link>

        <div className="admin-topbar__right">
          <Link
            to="/"
            className="admin-topbar__view"
            title="View the public site"
          >
            <Icon name="external-link" size={16} />
            <span className="admin-topbar__view-text">View site</span>
          </Link>
        </div>
      </header>

      <div
        className={`admin-backdrop ${navOpen ? 'is-open' : ''}`.trim()}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <div className="admin-body">
        <nav
          id="admin-nav"
          className={`admin-nav ${navOpen ? 'is-open' : ''}`.trim()}
          aria-label="Admin sections"
        >
          <div className="admin-nav__account">
            <span className="admin-nav__avatar" aria-hidden="true">
              {(user?.email ?? 'A').charAt(0).toUpperCase()}
            </span>
            <div className="admin-nav__account-text">
              <p className="admin-nav__site">{site.businessName}</p>
              <p className="admin-nav__email">{user?.email}</p>
            </div>
          </div>

          <ul className="admin-nav__list">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    `admin-nav__link ${isActive ? 'is-active' : ''}`.trim()
                  }
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="admin-nav__footer">
            <button
              type="button"
              className="admin-nav__link admin-nav__link--logout"
              onClick={() => setConfirmLogout(true)}
            >
              <Icon name="logout" size={18} />
              Log out
            </button>
          </div>
        </nav>

        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You will need to sign in again to manage bookings and content."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          void logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
