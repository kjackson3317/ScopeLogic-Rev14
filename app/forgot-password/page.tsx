'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/auth/callback?next=/update-password` });
      if (resetError) throw resetError;
      setEmail('');
      setMessage('Password reset email sent. Open the link in that email to set a new password.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password reset could not be started.');
    } finally { setLoading(false); }
  };

  return <main className="auth-page"><section className="auth-card">
    <img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" />
    <div className="auth-heading"><span>Account Recovery</span><h1>Reset your password</h1><p>Enter the email address connected to your ScopeLogic account.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>Email address</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {message && <div className="auth-success">{message}</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Email'}</button>
      <a className="auth-link" href="/login">Return to sign in</a>
    </form>
  </section></main>;
}
