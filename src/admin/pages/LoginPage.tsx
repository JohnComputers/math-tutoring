import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { requestPasswordReset } from '@/firebase/auth';
import { handleError } from '@/utils/errors';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { MathBackground } from '@/components/ui/MathBackground';

/**
 * Admin sign-in.
 *
 * Error messages are deliberately vague about *which* half was wrong — "Incorrect email
 * or password", never "no account with that email". Distinguishing the two turns the
 * login form into a way to test whether an address has an account here.
 */
export function LoginPage() {
  const { login, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      await login(email, password);
      // On success the auth listener swaps this whole screen out; nothing to do here.
    } catch {
      // `useAuth` already translated and stored the message.
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setResetError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (caught) {
      setResetError(handleError('LoginPage.reset', caught, 'Could not send the reset email.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <MathBackground variant="hero" />

      <div className="admin-login__card">
        <div className="admin-login__head">
          <span className="admin-login__mark" aria-hidden="true">
            <Icon name="sigma" size={22} strokeWidth={2.5} />
          </span>
          <h1 className="admin-login__title">
            {resetMode ? 'Reset your password' : 'Admin sign in'}
          </h1>
          <p className="admin-login__sub">
            {resetMode
              ? 'We will email you a link to set a new password.'
              : 'Manage bookings, availability and website content.'}
          </p>
        </div>

        {error && !resetMode && <Alert tone="error">{error}</Alert>}
        {resetError && <Alert tone="error">{resetError}</Alert>}
        {resetSent && (
          <Alert tone="success">
            If an account exists for that address, a reset link is on its way. Check your
            inbox and spam folder.
          </Alert>
        )}

        {resetMode ? (
          <form className="admin-login__form" onSubmit={handleReset} noValidate>
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />

            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              Send reset link
            </button>

            <button
              type="button"
              className="admin-login__link"
              onClick={() => {
                setResetMode(false);
                setResetSent(false);
                setResetError(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="admin-login__form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError();
              }}
              autoComplete="username"
              required
              placeholder="you@example.com"
            />

            <div className="admin-login__password">
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError();
                }}
                autoComplete="current-password"
                required
                placeholder="Your password"
              />
              <button
                type="button"
                className="admin-login__reveal"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              Sign in
            </button>

            <button
              type="button"
              className="admin-login__link"
              onClick={() => {
                setResetMode(true);
                clearError();
              }}
            >
              Forgot your password?
            </button>
          </form>
        )}

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
