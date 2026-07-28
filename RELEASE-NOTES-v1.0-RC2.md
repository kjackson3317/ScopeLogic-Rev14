# ScopeLogic v1.0 RC2 Release Notes

## Production foundation

- Added Supabase email/password authentication.
- Added protected routes and session refresh through Next.js `proxy.ts`.
- Added login, logout, forgot-password, and update-password screens.
- Added authenticated protection to the email API route.
- Added version-controlled Supabase migrations.
- Added Row Level Security policies and private Storage policies.
- Added a Production Setup administration page.
- Added one-time browser-record import with downloadable report.
- Preserved the existing Revision 14.8 interface and local browser fallback.

## Data included in the RC2 import

- Customers and contacts
- Projects and selected systems
- Project contacts
- Submitted SLR records
- Global SLR templates
- Document metadata
- Calendar events
- Contract details
- Internal notes
- Export history
- Email settings

## Deferred to RC3

- Uploading existing IndexedDB document file bytes to Supabase Storage
- Loading the primary workspace directly from Supabase instead of Local Storage
- Official release snapshots stored in Supabase Storage
- Automated database backup export
