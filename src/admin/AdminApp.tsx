import { Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { isFirebaseConfigured } from '@/firebase/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BookingsPage } from './pages/BookingsPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { ContentPage } from './pages/ContentPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { TestimonialsPage } from './pages/TestimonialsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LegalAdminPage } from './pages/LegalAdminPage';
import { NotAuthorised, SetupRequired } from './pages/AuthStates';
import { LoadingPanel } from '@/components/ui/Feedback';
import './admin.css';

/**
 * Admin shell and route guard.
 *
 * Access is gated on `status === 'admin'`, which means *both* signed in and present in
 * the `admins` collection. Every other state renders something else entirely, so the
 * dashboard components never mount for an unauthorised visitor.
 *
 * The UI gate is convenience, not security. Someone could edit their local JavaScript to
 * render this — and would find every read and write rejected, because `firestore.rules`
 * checks the same `admins/{uid}` document on the server for each individual operation.
 * That is the actual boundary; this just avoids showing a dashboard full of errors.
 */
export function AdminApp() {
  const { status } = useAuth();

  useDocumentMeta({
    title: 'Admin | Math Tutoring',
    noIndex: true, // never let the dashboard into search results
  });

  if (!isFirebaseConfigured()) return <SetupRequired />;

  if (status === 'loading') {
    return (
      <div className="admin-boot">
        <LoadingPanel message="Checking your session..." />
      </div>
    );
  }

  if (status === 'signedOut') return <LoginPage />;
  if (status === 'unauthorised') return <NotAuthorised />;

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="testimonials" element={<TestimonialsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="legal" element={<LegalAdminPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
