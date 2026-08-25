import { Link } from 'react-router-dom';
import type { LegalSettings } from '@/types';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import { RichText } from '@/components/ui/RichText';
import { SkeletonText } from '@/components/ui/Feedback';

/**
 * Renders one policy document.
 *
 * All five share this page — the content lives in `settings/legal` and is edited from the
 * admin, so the tutor can update a policy without a deploy.
 */

type LegalKey = keyof Omit<LegalSettings, 'updatedAt'>;

const SIBLINGS: { key: LegalKey; to: string; short: string }[] = [
  { key: 'privacy', to: '/privacy', short: 'Privacy' },
  { key: 'terms', to: '/terms', short: 'Terms' },
  { key: 'cancellation', to: '/cancellation', short: 'Cancellation' },
  { key: 'guardian', to: '/guardian', short: 'Parents & Guardians' },
  { key: 'accessibility', to: '/accessibility', short: 'Accessibility' },
];

export function LegalPage({ documentKey }: { documentKey: LegalKey }) {
  const { legal, site, loading } = useSiteContent();
  const doc = legal[documentKey];

  useDocumentMeta({
    title: `${doc.title} | ${site.businessName}`,
    description: `${doc.title} for ${site.businessName}.`,
  });

  return (
    <section className="section section--light legal-page">
      <MathBackground variant="light" density="sparse" />

      <div className="container legal-page__inner">
        <nav className="legal-page__breadcrumb" aria-label="Breadcrumb">
          <Link to="/">
            <Icon name="arrow-left" size={15} />
            Back to home
          </Link>
        </nav>

        <header className="legal-page__head">
          <h1 className="section-title">{doc.title}</h1>
          {doc.lastUpdated && (
            <p className="legal-page__updated">
              <Icon name="clock" size={14} />
              Last updated: {doc.lastUpdated}
            </p>
          )}
        </header>

        <div className="legal-page__layout">
          <article className="legal-page__body">
            {loading ? <SkeletonText lines={12} /> : <RichText content={doc.body} />}
          </article>

          <aside className="legal-page__aside" aria-label="Other policies">
            <h2 className="legal-page__aside-title">All policies</h2>
            <ul className="legal-page__links">
              {SIBLINGS.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className={item.key === documentKey ? 'is-current' : ''}
                    aria-current={item.key === documentKey ? 'page' : undefined}
                  >
                    {item.short}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="legal-page__contact">
              <p>Questions about any of this?</p>
              <Link to="/#contact" className="btn btn--sm btn--ghost-dark">
                Get in touch
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
