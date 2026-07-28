'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The password could not be updated.');
    } finally { setLoading(false); }
  };

  return <main className="auth-page"><section className="auth-card">
    <img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" />
    <div className="auth-heading"><span>Account Security</span><h1>Set a new password</h1><p>Create a strong password for your ScopeLogic account.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>New password</span><input type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label><span>Confirm password</span><input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading ? 'Saving…' : 'Save Password'}</button>
    </form>
  </section></main>;
}
