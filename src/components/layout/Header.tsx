import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScrollLock } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { telHref } from '@/utils/validation';
import { Icon } from '@/components/ui/Icon';
import './Header.css';

/**
 * Sticky site header with a mobile drawer.
 *
 * Section links are written `/#about`, which under `HashRouter` becomes `#/#about`:
 * react-router parses the path *and* its fragment out of the URL hash, so these stay
 * real anchors — right-clickable, shareable, and announced as links — while
 * `ScrollToHash` handles the smooth scroll.
 */

interface NavItem {
  label: string;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/#about' },
  { label: 'Subjects', to: '/#subjects' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Contact', to: '/#contact' },
];

export function Header() {
  const { site } = useSiteContent();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useScrollLock(menuOpen);

  // Close on navigation — the drawer must never survive a route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Solid background once the page scrolls, so the header never floats over
  // hero text ambiguously.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes, and focus returns to the toggle rather than being dropped.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  // Move focus into the drawer when it opens so keyboard users are not left behind it.
  useEffect(() => {
    if (!menuOpen) return;
    const timer = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [menuOpen]);

  const isActive = (item: NavItem): boolean => {
    if (item.to === '/schedule') return location.pathname === '/schedule';
    if (item.to === '/') return location.pathname === '/' && !location.hash;
    return location.pathname === '/' && location.hash === item.to.slice(1);
  };

  return (
    <>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`.trim()}>
        <div className="site-header__inner container">
          <Link to="/" className="brand" aria-label={`${site.businessName} — home`}>
            <span className="brand__mark" aria-hidden="true">
              <Icon name="sigma" size={20} strokeWidth={2.5} />
            </span>
            <span className="brand__text">
              <span className="brand__name">{site.tutorName}</span>
              <span className="brand__sub">Math Tutoring</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Main">
            <ul className="site-nav__list">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`site-nav__link ${isActive(item) ? 'is-active' : ''}`.trim()}
                    aria-current={isActive(item) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            <Link to="/schedule" className="btn btn--cream btn--sm site-header__cta">
              Book a Session
            </Link>

            <button
              ref={toggleRef}
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={24} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop: click anywhere outside the drawer to dismiss. */}
      <div
        className={`drawer-backdrop ${menuOpen ? 'is-open' : ''}`.trim()}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div
        id="mobile-drawer"
        ref={drawerRef}
        className={`drawer ${menuOpen ? 'is-open' : ''}`.trim()}
        // Hidden from assistive tech when closed, so its links are not reachable
        // by tab or virtual cursor while off-screen.
        {...(menuOpen ? {} : { inert: '' })}
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Mobile">
          <ul className="drawer__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`drawer__link ${isActive(item) ? 'is-active' : ''}`.trim()}
                  aria-current={isActive(item) ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <Icon name="chevron-right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="drawer__footer">
          <Link
            to="/schedule"
            className="btn btn--primary btn--block"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="calendar" size={18} />
            Schedule a Session
          </Link>
          {site.contact.phone && (
            <a href={telHref(site.contact.phone)} className="btn btn--ghost-dark btn--block">
              <Icon name="phone" size={18} />
              {site.contact.phoneCtaLabel || site.contact.phone}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
