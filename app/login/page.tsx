import LoginForm from '../auth-components/login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const requested = params.next || '/';
  const nextPath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  return <main className="auth-page"><section className="auth-card">
    <img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" />
    <div className="auth-heading"><span>Production Workspace</span><h1>Sign in to ScopeLogic</h1><p>Access is restricted to authorized ScopeLogic users.</p></div>
    <LoginForm nextPath={nextPath} initialError={params.error || ''} />
  </section></main>;
}
