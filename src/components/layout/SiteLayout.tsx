import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '@/hooks/useMotion';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * Restore sane scroll behaviour on navigation.
 *
 * A single-page app keeps the scroll position across route changes, so without this a
 * visitor clicking "Privacy Policy" from the bottom of the homepage lands halfway down
 * the policy. Anchor links (`/#about`) are the exception: those *should* scroll to their
 * target instead of the top.
 *
 * The target is focused as well as scrolled, so a keyboard user's next Tab continues from
 * the section they jumped to rather than from the top of the document.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      // Defer a frame: on a fresh page load the target may not be mounted yet.
      const timer = window.setTimeout(() => {
        const target = document.getElementById(id);
        if (!target) return;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
        // `tabindex="-1"` is set on section wrappers so this is focusable without
        // adding them to the tab order.
        target.focus({ preventScroll: true });
      }, 80);
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return undefined;
  }, [pathname, hash, prefersReducedMotion]);

  return null;
}

export function SiteLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <ScrollManager />
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
