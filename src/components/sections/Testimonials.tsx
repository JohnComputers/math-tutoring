import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';

/**
 * Testimonials.
 *
 * Renders nothing at all when there are none — an empty "What Families Say" heading
 * looks worse than no section, and inventing quotes was never an option.
 *
 * Display names only. The admin field is labelled to make that explicit, and the Privacy
 * Policy commits to never publishing a student's name.
 */
export function Testimonials() {
  const { site, testimonials } = useSiteContent();

  if (testimonials.length === 0) return null;

  return (
    <section className="section section--white" aria-labelledby="testimonials-title">
      <div className="container">
        <div className="section-head section-head--center">
          <p className="eyebrow">
            <Icon name="quote" size={14} />
            Testimonials
          </p>
          <h2 className="section-title" id="testimonials-title">
            {site.testimonialsHeading}
          </h2>
          {site.testimonialsSubheading && (
            <p className="section-subtitle">{site.testimonialsSubheading}</p>
          )}
        </div>

        <ul className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <li key={testimonial.id} className="reveal">
              <figure className="card testimonial-card">
                <Icon name="quote" size={28} className="testimonial-card__mark" />

                {testimonial.rating > 0 && (
                  <div
                    className="testimonial-card__rating"
                    role="img"
                    aria-label={`${testimonial.rating} out of 5`}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Icon
                        key={index}
                        name="star"
                        size={16}
                        className={
                          index < testimonial.rating
                            ? 'testimonial-card__star is-filled'
                            : 'testimonial-card__star'
                        }
                      />
                    ))}
                  </div>
                )}

                <blockquote className="testimonial-card__quote">
                  <p>{testimonial.quote}</p>
                </blockquote>

                <figcaption className="testimonial-card__author">
                  <span className="testimonial-card__name">{testimonial.author}</span>
                  {testimonial.relationship && (
                    <span className="testimonial-card__role">{testimonial.relationship}</span>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
