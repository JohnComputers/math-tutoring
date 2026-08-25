import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { SiteContentProvider } from '@/hooks/useSiteContent';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { LoadingPanel } from '@/components/ui/Feedback';
import { HomePage } from '@/pages/HomePage';
import { LegalPage } from '@/pages/LegalPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SchedulePage } from '@/pages/SchedulePage';

/**
 * Routing.
 *
 * `HashRouter` is a deliberate choice for GitHub Pages. Pages serves static files with no
 * server-side rewrite, so with `BrowserRouter` a refresh on `/schedule` asks GitHub for a
 * file that does not exist and returns its 404. The usual workaround — a `404.html` that
 * bounces back into `index.html` carrying the path — works, but it costs an extra round
 * trip and a visible flash on every deep link, and it breaks quietly on custom domains.
 * The hash never reaches the server at all, so `#/schedule` survives a refresh
 * unconditionally. `public/404.html` is still shipped as a safety net for anyone who
 * lands on a non-hash path.
 *
 * The admin bundle is lazy-loaded: it is a large chunk that no visiting parent will ever
 * need, and keeping it out of the initial download is most of the point of code-splitting
 * on a mobile-first site.
 */

const AdminApp = lazy(() =>
  import('@/admin/AdminApp').then((module) => ({ default: module.AdminApp })),
);

export default function App() {
  return (
    <ErrorBoundary>
      <SiteContentProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              {/* Admin sits outside the marketing layout: its own chrome, no site
                  header or footer. */}
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<LoadingPanel message="Loading the dashboard..." />}>
                    <AdminApp />
                  </Suspense>
                }
              />

              <Route element={<SiteLayout />}>
                <Route index element={<HomePage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="privacy" element={<LegalPage documentKey="privacy" />} />
                <Route path="terms" element={<LegalPage documentKey="terms" />} />
                <Route
                  path="cancellation"
                  element={<LegalPage documentKey="cancellation" />}
                />
                <Route path="guardian" element={<LegalPage documentKey="guardian" />} />
                <Route
                  path="accessibility"
                  element={<LegalPage documentKey="accessibility" />}
                />

                {/* Friendly aliases for URLs people type or that appear in old links. */}
                <Route path="book" element={<Navigate to="/schedule" replace />} />
                <Route path="privacy-policy" element={<Navigate to="/privacy" replace />} />
                <Route path="terms-of-service" element={<Navigate to="/terms" replace />} />

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </AuthProvider>
      </SiteContentProvider>
    </ErrorBoundary>
  );
}
