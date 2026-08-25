import { Link } from 'react-router-dom';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';

/**
 * Subject cards.
 *
 * Driven entirely by the `subjects` collection — the four starter subjects are seed
 * data, not a fixed set. Adding a fifth in the admin adds a fifth card here with no
 * code change, which is the whole point of the CMS.
 */
export function Subjects() {
  const { site, subjects, loading } = useSiteContent();

  return (
    <section
      className="section section--dark"
      id="subjects"
      tabIndex={-1}
      aria-labelledby="subjects-title"
    >
      <MathBackground variant="dark" />

      <div className="container">
        <div className="section-head section-head--center">
          <p className="eyebrow">
            <Icon name="book" size={14} />
            Subjects
          </p>
          <h2 className="section-title" id="subjects-title">
            {site.subjectsHeading}
          </h2>
          {site.subjectsSubheading && (
            <p className="section-subtitle">{site.subjectsSubheading}</p>
          )}
        </div>

        {loading ? (
          <div className="grid grid--2 grid--4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="card card--dark">
                <Skeleton dark height="48px" width="48px" radius="var(--radius-md)" />
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <Skeleton dark height="1.2rem" width="60%" />
                </div>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Skeleton dark height="0.8rem" />
                </div>
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <EmptyState
            icon="book"
            title="No subjects listed yet"
            description="Subjects added in the admin dashboard will appear here."
          />
        ) : (
          <ul className="subject-grid">
            {subjects.map((subject) => (
              <li key={subject.id} className="reveal">
                <article className="card card--dark card--interactive subject-card">
                  <span className="icon-badge">
                    <Icon name={subject.icon} size={22} />
                  </span>

                  <h3 className="card__title subject-card__title">{subject.name}</h3>

                  {subject.gradeRange && (
                    <span className="chip chip--cream subject-card__grade">
                      {subject.gradeRange}
                    </span>
                  )}

                  <p className="card__body subject-card__body">{subject.description}</p>

                  {subject.priceLabel && (
                    <p className="subject-card__price">{subject.priceLabel}</p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}

        <div className="btn-row btn-row--center subject-grid__cta">
          <Link to="/schedule" className="btn btn--cream">
            <Icon name="calendar" size={18} />
            Book a session
          </Link>
        </div>
      </div>
    </section>
  );
}
