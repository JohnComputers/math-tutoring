import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import { SkeletonText } from '@/components/ui/Feedback';

/** Split a plain-text block into paragraphs on blank lines. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * About section: portrait, bio, qualifications, teaching philosophy.
 *
 * Qualifications render exactly as the admin typed them. Nothing here embellishes or
 * infers a credential — if the list says "AP Calculus student", the page says that and
 * not "certified instructor".
 */
export function About() {
  const { site, loading } = useSiteContent();
  const { about } = site;

  return (
    <section className="section section--light" id="about" tabIndex={-1} aria-labelledby="about-title">
      <MathBackground variant="light" density="sparse" />

      <div className="container about">
        <div className="about__media reveal">
          {about.photoUrl ? (
            <img
              className="about__photo"
              src={about.photoUrl}
              alt={about.photoAlt || `${site.tutorName}, math tutor`}
              width={480}
              height={560}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="about__photo about__photo--placeholder" aria-hidden="true">
              <Icon name="graduation" size={54} />
            </div>
          )}

          <div className="about__badge">
            <span className="about__badge-name">{site.tutorName}</span>
            <span className="about__badge-role">{site.tagline}</span>
          </div>
        </div>

        <div className="about__body">
          <div className="section-head">
            <p className="eyebrow">
              <Icon name="users" size={14} />
              About
            </p>
            <h2 className="section-title" id="about-title">
              {about.heading}
            </h2>
          </div>

          {loading ? (
            <SkeletonText lines={5} />
          ) : (
            <div className="prose about__bio">
              {paragraphs(about.bio).map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          )}

          {about.qualifications.length > 0 && (
            <div className="about__quals reveal">
              <h3 className="about__quals-title">Background</h3>
              <ul className="about__quals-list">
                {about.qualifications.map((item) => (
                  <li key={item} className="about__qual">
                    <Icon name="check" size={16} strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {about.teachingPhilosophy && (
            <div className="about__philosophy reveal">
              <h3 className="about__philosophy-title">
                <Icon name="lightbulb" size={18} />
                {about.teachingPhilosophyHeading}
              </h3>
              <div className="prose">
                {paragraphs(about.teachingPhilosophy).map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
