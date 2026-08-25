import { Link } from 'react-router-dom';
import { useSiteContent } from '@/hooks/useSiteContent';
import { formatPhone, telHref } from '@/utils/validation';
import { Icon } from '@/components/ui/Icon';
import './Footer.css';

/**
 * Site footer: contact, the policy pages, and a deliberately quiet admin link.
 *
 * The admin link is present because the owner needs a way in from a phone, but it is
 * styled as ordinary small print rather than a call to action — it is not something a
 * visiting parent should be invited to click.
 */

const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/cancellation', label: 'Cancellation Policy' },
  { to: '/guardian', label: 'Parent & Guardian Notice' },
  { to: '/accessibility', label: 'Accessibility' },
];

export function Footer() {
  const { site } = useSiteContent();
  const year = new Date().getFullYear();
  const copyright = site.footer.copyright.replace('{year}', String(year));

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="sigma" size={20} strokeWidth={2.5} />
          </span>
          <p className="site-footer__name">{site.businessName}</p>
          <p className="site-footer__tagline">{site.footer.tagline}</p>

          {site.contact.socials.length > 0 && (
            <ul className="site-footer__socials">
              {site.contact.socials.map((social) => (
                <li key={social.id}>
                  <a
                    href={social.url}
                    className="site-footer__social"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.label} (opens in a new tab)`}
                  >
                    <Icon name={social.icon} size={18} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="site-footer__column" aria-label="Site">
          <h2 className="site-footer__heading">Explore</h2>
          <ul className="site-footer__links">
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/#about">About</Link>
            </li>
            <li>
              <Link to="/#subjects">Subjects</Link>
            </li>
            <li>
              <Link to="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link to="/schedule">Schedule a Session</Link>
            </li>
          </ul>
        </nav>

        <nav className="site-footer__column" aria-label="Policies">
          <h2 className="site-footer__heading">Policies</h2>
          <ul className="site-footer__links">
            {LEGAL_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-footer__column">
          <h2 className="site-footer__heading">Contact</h2>
          <ul className="site-footer__links site-footer__links--contact">
            {site.contact.phone && (
              <li>
                <a href={telHref(site.contact.phone)}>
                  <Icon name="phone" size={15} />
                  {formatPhone(site.contact.phone)}
                </a>
              </li>
            )}
            {site.contact.email && (
              <li>
                <a href={`mailto:${site.contact.email}`}>
                  <Icon name="mail" size={15} />
                  {site.contact.email}
                </a>
              </li>
            )}
            {site.contact.location && (
              <li className="site-footer__plain">
                <Icon name="clock" size={15} />
                {site.contact.location}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <p className="site-footer__copyright">{copyright}</p>
        <Link to="/admin" className="site-footer__admin">
          Site admin
        </Link>
      </div>
    </footer>
  );
}
