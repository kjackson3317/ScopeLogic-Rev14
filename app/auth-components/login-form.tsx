'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginForm({ nextPath, initialError }: { nextPath: string; initialError: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      router.replace(nextPath || '/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return <form className="auth-form" onSubmit={submit}>
    <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
    <a className="auth-link" href="/forgot-password">Forgot password?</a>
  </form>;
}
