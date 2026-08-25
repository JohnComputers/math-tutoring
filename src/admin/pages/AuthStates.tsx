import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { missingFirebaseKeys } from '@/firebase/config';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/**
 * Shown when someone is signed in but has no `admins/{uid}` document.
 *
 * The uid is displayed because it is exactly what the owner needs to paste into the
 * setup script to grant themselves access — and it is the one piece of information that
 * is genuinely hard to find otherwise. It is not a secret: it identifies the account
 * already signed in on this device, and possessing it grants nothing.
 */
export function NotAuthorised() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-login">
      <MathBackground variant="hero" />

      <div className="admin-login__card">
        <div className="admin-login__head">
          <span className="admin-login__mark admin-login__mark--warn" aria-hidden="true">
            <Icon name="shield" size={22} />
          </span>
          <h1 className="admin-login__title">Not an admin account</h1>
          <p className="admin-login__sub">
            You are signed in, but this account has not been granted admin access.
          </p>
        </div>

        <div className="admin-login__detail">
          <p className="admin-login__detail-label">Signed in as</p>
          <p className="admin-login__detail-value">{user?.email}</p>

          <p className="admin-login__detail-label">Account ID (UID)</p>
          <code className="admin-login__uid">{user?.uid}</code>
          <p className="admin-login__hint">
            To grant access, run <code>npm run setup:admin</code> from the project folder
            and give it this email address. See the README under &ldquo;Creating the first
            admin&rdquo;.
          </p>
        </div>

        <button type="button" className="btn btn--ghost-dark btn--block" onClick={() => void logout()}>
          <Icon name="logout" size={17} />
          Sign out
        </button>

        <div className="admin-login__foot">
          <Link to="/">
            <Icon name="arrow-left" size={15} />
            Back to the website
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Shown when the Firebase environment variables are missing entirely. */
export function SetupRequired() {
  const missing = missingFirebaseKeys();

  return (
    <div className="admin-login">
      <MathBackground variant="hero" />

      <div className="admin-login__card">
        <div className="admin-login__head">
          <span className="admin-login__mark admin-login__mark--warn" aria-hidden="true">
            <Icon name="settings" size={22} />
          </span>
          <h1 className="admin-login__title">Firebase is not configured</h1>
          <p className="admin-login__sub">
            The admin dashboard needs a Firebase project before it can do anything.
          </p>
        </div>

        <div className="admin-login__detail">
          <p className="admin-login__detail-label">Missing environment variables</p>
          <ul className="admin-login__missing">
            {missing.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          <p className="admin-login__hint">
            Copy <code>.env.example</code> to <code>.env</code>, fill in the values from
            your Firebase project settings, and restart the dev server. For the deployed
            site, add the same names as GitHub Actions secrets. Full walkthrough in the
            README.
          </p>
        </div>

        <div className="admin-login__foot">
          <Link to="/">
            <Icon name="arrow-left" size={15} />
            Back to the website
          </Link>
        </div>
      </div>
    </div>
  );
}
