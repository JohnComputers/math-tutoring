import { Link } from 'react-router-dom';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/** 404. Keeps the brand voice rather than dumping a bare error. */
export function NotFoundPage() {
  const { site } = useSiteContent();

  useDocumentMeta({
    title: `Page not found | ${site.businessName}`,
    description: 'That page does not exist.',
    noIndex: true,
  });

  return (
    <section className="section section--dark not-found">
      <MathBackground variant="dark" />

      <div className="container container--narrow text-center not-found__inner">
        <p className="not-found__code" aria-hidden="true">
          404
        </p>
        <h1 className="section-title">This page is undefined</h1>
        <p className="section-subtitle">
          The page you were looking for does not exist — a bit like dividing by zero. Let
          us get you back to somewhere that does.
        </p>

        <div className="btn-row btn-row--center not-found__actions">
          <Link to="/" className="btn btn--cream btn--lg">
            <Icon name="arrow-left" size={19} />
            Back to home
          </Link>
          <Link to="/schedule" className="btn btn--ghost-light btn--lg">
            <Icon name="calendar" size={19} />
            Schedule a session
          </Link>
        </div>
      </div>
    </section>
  );
}
