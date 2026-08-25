import { Link } from 'react-router-dom';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';
import { formatPhone, telHref } from '@/utils/validation';

/**
 * Contact.
 *
 * On a phone the number is a `tel:` link, so tapping it dials rather than making someone
 * copy digits out of a page. `telHref` also adds the country code, which matters if the
 * number is ever tapped from abroad.
 */
export function Contact() {
  const { site } = useSiteContent();
  const { contact } = site;

  return (
    <section
      className="section section--light"
      id="contact"
      tabIndex={-1}
      aria-labelledby="contact-title"
    >
      <MathBackground variant="light" density="sparse" />

      <div className="container contact">
        <div className="contact__intro">
          <p className="eyebrow">
            <Icon name="message" size={14} />
            Contact
          </p>
          <h2 className="section-title" id="contact-title">
            {contact.heading}
          </h2>
          {contact.subheading && <p className="section-subtitle">{contact.subheading}</p>}

          <div className="btn-row contact__actions">
            {contact.phone && (
              <a href={telHref(contact.phone)} className="btn btn--primary btn--lg">
                <Icon name="phone" size={19} />
                {contact.phoneCtaLabel || `Text ${formatPhone(contact.phone)}`}
              </a>
            )}
            <Link to="/schedule" className="btn btn--ghost-dark btn--lg">
              <Icon name="calendar" size={19} />
              Schedule a Session
            </Link>
          </div>
        </div>

        <ul className="contact__details">
          {contact.phone && (
            <li className="contact__detail">
              <span className="icon-badge">
                <Icon name="phone" size={20} />
              </span>
              <div>
                <p className="contact__detail-label">Phone</p>
                <a href={telHref(contact.phone)} className="contact__detail-value">
                  {formatPhone(contact.phone)}
                </a>
              </div>
            </li>
          )}

          {contact.email && (
            <li className="contact__detail">
              <span className="icon-badge">
                <Icon name="mail" size={20} />
              </span>
              <div>
                <p className="contact__detail-label">Email</p>
                <a href={`mailto:${contact.email}`} className="contact__detail-value">
                  {contact.email}
                </a>
              </div>
            </li>
          )}

          {contact.location && (
            <li className="contact__detail">
              <span className="icon-badge">
                <Icon name="clock" size={20} />
              </span>
              <div>
                <p className="contact__detail-label">Availability</p>
                <p className="contact__detail-value">{contact.location}</p>
              </div>
            </li>
          )}

          {contact.socials.length > 0 && (
            <li className="contact__detail">
              <span className="icon-badge">
                <Icon name="globe" size={20} />
              </span>
              <div>
                <p className="contact__detail-label">Elsewhere</p>
                <ul className="contact__socials">
                  {contact.socials.map((social) => (
                    <li key={social.id}>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact__detail-value"
                      >
                        <Icon name={social.icon} size={15} />
                        {social.label}
                        <Icon name="external-link" size={12} />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
