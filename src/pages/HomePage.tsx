import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useScrollReveal } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Hero } from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { Subjects } from '@/components/sections/Subjects';
import { WhyMe } from '@/components/sections/WhyMe';
import { Pricing } from '@/components/sections/Pricing';
import { Testimonials } from '@/components/sections/Testimonials';
import { ScheduleCta } from '@/components/sections/ScheduleCta';
import { Contact } from '@/components/sections/Contact';
import { Alert } from '@/components/ui/Feedback';

/**
 * The homepage.
 *
 * Section order follows the journey the site is designed around: who I am, what I teach,
 * why it helps, what it costs, book now, how to reach me. Backgrounds alternate
 * dark/light/cream so the page reads as distinct bands rather than one long wall.
 */
export function HomePage() {
  const { site, loading, error, configured } = useSiteContent();

  useDocumentMeta({
    title: site.seo.title,
    description: site.seo.description,
    ...(site.seo.canonicalUrl ? { canonicalUrl: site.seo.canonicalUrl } : {}),
    ...(site.seo.ogImageUrl ? { ogImageUrl: site.seo.ogImageUrl } : {}),
  });

  // Re-run once content lands, so sections rendered after the fetch are observed too.
  useScrollReveal(true, loading);

  return (
    <>
      {!configured && (
        <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
          <Alert tone="warning">
            <strong>Setup needed:</strong> Firebase is not configured, so this page is
            showing default content and scheduling is disabled. See the README to connect
            a Firebase project.
          </Alert>
        </div>
      )}

      {error && (
        <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
          <Alert tone="warning">{error}</Alert>
        </div>
      )}

      <Hero />
      <About />
      <Subjects />
      <WhyMe />
      <Pricing />
      <Testimonials />
      <ScheduleCta />
      <Contact />
    </>
  );
}
