import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import Workspace from './workspace';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <Workspace userEmail={user.email || 'Signed-in user'} />;
}
