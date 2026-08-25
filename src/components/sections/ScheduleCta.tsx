import { Link } from 'react-router-dom';
import { useParallax } from '@/hooks/useMotion';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/** The loud, unmissable "book now" band between pricing and contact. */
export function ScheduleCta() {
  const { site } = useSiteContent();
  const parallaxRef = useParallax(0.6);
  const { scheduleCta } = site;

  return (
    <section className="section schedule-cta" ref={parallaxRef} aria-labelledby="cta-title">
      <MathBackground variant="hero" />

      <div className="container container--narrow text-center schedule-cta__inner">
        <h2 className="schedule-cta__heading" id="cta-title">
          {scheduleCta.heading}
        </h2>

        {scheduleCta.subheading && (
          <p className="schedule-cta__subheading">{scheduleCta.subheading}</p>
        )}

        <div className="btn-row btn-row--center schedule-cta__actions">
          <Link to="/schedule" className="btn btn--cream btn--lg">
            <Icon name="calendar" size={20} />
            {scheduleCta.buttonLabel}
          </Link>
        </div>

        <p className="schedule-cta__note">
          <Icon name="clock" size={15} />
          Takes about a minute. No account needed.
        </p>
      </div>
    </section>
  );
}
