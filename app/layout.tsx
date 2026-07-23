import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ScopeLogic Revision 14.7',
  description: 'Division 27/28 scope and procurement workspace',
  icons: {
    icon: '/brand/scopelogic-app-icon.png',
    apple: '/brand/scopelogic-app-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
