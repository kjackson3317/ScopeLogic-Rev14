# ScopeLogic v1.0 RC2

ScopeLogic v1.0 RC2 is the first production-foundation release. It preserves the Revision 14.8 estimating and deliverable interface while adding Supabase authentication, protected routes, a version-controlled database schema, Row Level Security, email-route authentication, and a one-time browser-data import workflow.

## Included

- Email/password login and logout
- Forgot-password and set-password workflows
- Supabase SSR cookie/session handling for Next.js 16
- Protected application routes
- Authenticated email API route
- Initial PostgreSQL schema under `supabase/migrations`
- Row Level Security for all application tables
- Private `project-files` storage policies
- Production Setup page
- One-time import of existing browser records
- Import report download
- Existing browser data retained as a fallback

## Important scope limitation

RC2 imports database records and document metadata. It does **not** upload the actual document file bytes currently stored in browser IndexedDB. Continue using the same device, browser, and production domain until the document-storage migration is completed in the next release.

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Existing Resend variables remain required for email delivery.

## Deployment

Follow `PRODUCTION-DEPLOYMENT.md` in order. Do not select **Import Existing ScopeLogic Data** until the database migration has been applied successfully.
