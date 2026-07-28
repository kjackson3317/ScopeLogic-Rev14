# ScopeLogic v1.0 RC2 — Acceptance Checklist

## Deployment

- [ ] Vercel build completed successfully
- [ ] Production URL loads the login page when signed out
- [ ] Administrator login succeeds
- [ ] Sign Out returns to the login page
- [ ] Forgot-password email can be requested

## Database

- [ ] `npx supabase db push` completed successfully
- [ ] `profiles` contains the administrator user
- [ ] Anonymous users cannot read application tables
- [ ] Production Setup reports that the database is available

## Import

- [ ] Local counts were reviewed before import
- [ ] Import completed without an error
- [ ] Import report was downloaded
- [ ] Project count matches the browser workspace
- [ ] SLR count matches the browser workspace
- [ ] Customer/contact counts match the browser workspace
- [ ] Browser data remains available after import

## Existing workflows

- [ ] Individual PDFs generate
- [ ] Contractor checklist generates and remains editable
- [ ] Generate All PDFs works
- [ ] Email route requires authentication
- [ ] Email sends after the Resend key and sender domain are valid

## Known RC2 limitation

- [ ] Document metadata is in Supabase
- [ ] Actual document file bytes are still in browser IndexedDB and have not been deleted
