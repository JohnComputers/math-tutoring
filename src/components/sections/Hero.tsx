import { Link } from 'react-router-dom';
import { useParallax } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import { Skeleton } from '@/components/ui/Feedback';

/**
 * Hero.
 *
 * The whole point of this block is the first ten seconds: who this is, what they teach,
 * what it costs, and how to book. Everything else on the page is elaboration, so the
 * price and both CTAs are visible without scrolling even on an iPhone SE.
 */
export function Hero() {
  const { site, subjects, loading } = useSiteContent();
  const parallaxRef = useParallax();

  const featuredTier =
    site.pricing.tiers.find((tier) => tier.featured && tier.visible) ??
    site.pricing.tiers.find((tier) => tier.visible);

  const subjectNames = subjects.slice(0, 4).map((subject) => subject.name);

  return (
    <section className="hero" ref={parallaxRef}>
      <MathBackground variant="hero" />

      <div className="container hero__inner">
        <div className="hero__content">
          {site.hero.eyebrow && (
            <p className="hero__eyebrow">
              <Icon name="sparkles" size={14} />
              {site.hero.eyebrow}
            </p>
          )}

          <h1 className="hero__heading">{site.hero.heading}</h1>

          <p className="hero__subheading">{site.hero.subheading}</p>

          {subjectNames.length > 0 && (
            <ul className="hero__subjects" aria-label="Subjects tutored">
              {subjectNames.map((name) => (
                <li key={name} className="hero__subject">
                  {name}
                </li>
              ))}
            </ul>
          )}

          <div className="hero__actions">
            <Link to="/schedule" className="btn btn--primary btn--lg">
              <Icon name="calendar" size={20} />
              {site.hero.primaryCtaLabel}
            </Link>
            <Link to="/#about" className="btn btn--ghost-light btn--lg">
              {site.hero.secondaryCtaLabel}
            </Link>
          </div>

          {featuredTier && (
            <p className="hero__price">
              <span className="hero__price-amount">
                {site.pricing.currencySymbol}
                {featuredTier.price}
              </span>
              <span className="hero__price-unit">
                / {featuredTier.durationMinutes === 60 ? 'hour' : `${featuredTier.durationMinutes} min`}
              </span>
            </p>
          )}
        </div>

        <div className="hero__portrait-wrap">
          <div className="hero__portrait-frame" data-parallax="-0.04">
            {loading && !site.about.photoUrl ? (
              <Skeleton height="100%" radius="var(--radius-xl)" dark />
            ) : site.about.photoUrl ? (
              <img
                className="hero__portrait"
                src={site.about.photoUrl}
                alt={site.about.photoAlt || `${site.tutorName}, math tutor`}
                width={420}
                height={520}
                // Above the fold: load eagerly and hint high priority so the LCP
                // element is not queued behind other requests.
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              // No photo uploaded yet: a branded monogram beats a broken-image icon,
              // and it means the layout is identical before and after the upload.
              <div className="hero__portrait-placeholder" role="img" aria-label={site.tutorName}>
                <span>
                  {site.tutorName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0] ?? '')
                    .join('')}
                </span>
              </div>
            )}
          </div>

          <p className="hero__intro">{site.hero.intro}</p>
        </div>
      </div>
    </section>
  );
}
