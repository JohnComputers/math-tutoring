import { Link } from 'react-router-dom';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/**
 * Pricing.
 *
 * The data model supports several tiers; the seed ships one, because one honest rate is
 * a stronger pitch than a fabricated ladder. Adding 30- and 90-minute tiers in the admin
 * makes this lay out as a row automatically.
 *
 * No payment is taken here by design — the MVP schedules sessions, and money changes
 * hands directly. That keeps card data entirely out of this system.
 */
export function Pricing() {
  const { site } = useSiteContent();
  const { pricing } = site;
  const tiers = pricing.tiers.filter((tier) => tier.visible);

  if (tiers.length === 0) return null;

  return (
    <section
      className="section section--cream"
      id="pricing"
      tabIndex={-1}
      aria-labelledby="pricing-title"
    >
      <MathBackground variant="light" density="sparse" />

      <div className="container">
        <div className="section-head section-head--center">
          <p className="eyebrow">
            <Icon name="percent" size={14} />
            Pricing
          </p>
          <h2 className="section-title" id="pricing-title">
            {pricing.heading}
          </h2>
          {pricing.subheading && <p className="section-subtitle">{pricing.subheading}</p>}
        </div>

        <ul
          className={`pricing-grid ${tiers.length === 1 ? 'pricing-grid--single' : ''}`.trim()}
        >
          {tiers.map((tier) => (
            <li key={tier.id} className="reveal">
              <article
                className={`card pricing-card ${tier.featured ? 'pricing-card--featured' : ''}`.trim()}
              >
                {tier.featured && tiers.length > 1 && (
                  <span className="pricing-card__ribbon">Most popular</span>
                )}

                <h3 className="pricing-card__label">{tier.label}</h3>

                <p className="pricing-card__price">
                  <span className="pricing-card__currency">{pricing.currencySymbol}</span>
                  <span className="pricing-card__amount">{tier.price}</span>
                  <span className="pricing-card__unit">
                    /{' '}
                    {tier.durationMinutes === 60
                      ? 'hour'
                      : `${tier.durationMinutes} min`}
                  </span>
                </p>

                <p className="pricing-card__duration">
                  <Icon name="clock" size={15} />
                  {tier.durationMinutes} minute session
                </p>

                {tier.description && (
                  <p className="card__body pricing-card__body">{tier.description}</p>
                )}

                <Link
                  to="/schedule"
                  className={`btn btn--block ${tier.featured ? 'btn--primary' : 'btn--ghost-dark'}`}
                >
                  Book this session
                </Link>
              </article>
            </li>
          ))}
        </ul>

        {pricing.note && (
          <p className="pricing-note">
            <Icon name="info" size={16} />
            <span>{pricing.note}</span>
          </p>
        )}
      </div>
    </section>
  );
}
