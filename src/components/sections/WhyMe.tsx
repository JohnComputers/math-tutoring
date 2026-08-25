import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/** Selling points. Fully admin-editable — add, remove, or rewrite any of them. */
export function WhyMe() {
  const { site } = useSiteContent();
  const { why } = site;

  if (why.points.length === 0) return null;

  return (
    <section className="section section--white" aria-labelledby="why-title">
      <MathBackground variant="light" density="sparse" />

      <div className="container">
        <div className="section-head section-head--center">
          <p className="eyebrow">
            <Icon name="target" size={14} />
            Why tutor with me
          </p>
          <h2 className="section-title" id="why-title">
            {why.heading}
          </h2>
          {why.subheading && <p className="section-subtitle">{why.subheading}</p>}
        </div>

        <ul className="why-grid">
          {why.points.map((point) => (
            <li key={point.id} className="reveal">
              <article className="card card--interactive why-card">
                <span className="icon-badge">
                  <Icon name={point.icon} size={22} />
                </span>
                <h3 className="card__title why-card__title">{point.title}</h3>
                <p className="card__body">{point.body}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
