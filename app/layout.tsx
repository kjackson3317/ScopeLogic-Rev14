import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ScopeLogic Revision 14.3',
  description: 'Division 27/28 scope and procurement workspace'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
