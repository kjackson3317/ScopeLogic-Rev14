# ScopeLogic v1.0 RC2 — Production Deployment

## Before starting

- Keep the browser and computer that currently contain your ScopeLogic data.
- Do not clear browser history, site data, cookies, Local Storage, or IndexedDB.
- Keep using the same permanent Vercel production domain. Browser data is tied to the exact website origin.
- Confirm the Supabase administrator user was created with a password and is email-confirmed.

## Part 1 — Upload RC2 to GitHub

1. Extract the RC2 ZIP.
2. Open the GitHub repository connected to Vercel.
3. Replace the repository contents with the extracted RC2 files.
4. Confirm the repository includes:
   - `proxy.ts`
   - `lib/supabase/`
   - `app/login/`
   - `supabase/migrations/20260728000100_scopelogic_v1_foundation.sql`
5. Commit the files to the branch connected to Vercel.
6. Wait for Vercel to build and deploy.

## Part 2 — Apply the database migration

Use the migration file through the Supabase CLI so the schema remains version-controlled.

### 2.1 Open a terminal in the extracted repository

On Windows:

1. Open the extracted RC2 folder in File Explorer.
2. Click the address bar.
3. Type `powershell` and press Enter.

### 2.2 Sign in to the Supabase CLI

```powershell
npx supabase@latest login
```

A browser window will open. Approve the login.

### 2.3 Find the Supabase project reference

In Supabase:

1. Open the ScopeLogic Production project.
2. Open **Project Settings**.
3. Open **General**.
4. Copy the **Reference ID**.

It resembles:

```text
abcdefghijklmnop
```

### 2.4 Link the repository

```powershell
npx supabase@latest link --project-ref YOUR_PROJECT_REFERENCE
```

Replace `YOUR_PROJECT_REFERENCE` with the actual Reference ID.

The CLI may ask for the database password created when the Supabase project was created. If that password is unavailable, reset it under **Supabase → Project Settings → Database** and store the new password securely.

### 2.5 Push the migration

```powershell
npx supabase@latest db push
```

Review the migration name and approve the prompt.

Successful output should indicate that the remote database is up to date.

## Part 3 — Test authentication

1. Open the permanent ScopeLogic production URL in a private/incognito window.
2. Confirm it redirects to `/login`.
3. Sign in using the administrator email and password created in Supabase.
4. Confirm the ScopeLogic workspace opens.
5. Confirm the signed-in email and **Sign Out** button appear in the top bar.
6. Sign out and confirm the dashboard is no longer accessible without signing in.

## Part 4 — Import the existing browser data

Perform this step in the original browser profile and computer where the ScopeLogic data currently exists.

1. Open ScopeLogic and sign in.
2. Open **Administration → Production Setup**.
3. Confirm the local record counts look reasonable.
4. Confirm the database status says the production tables are available.
5. Check the import acknowledgment.
6. Select **Import Existing ScopeLogic Data**.
7. Wait for the **Saved** confirmation.
8. Download the import report.
9. Do not delete the browser copy.

The import includes customers, contacts, projects, systems, submitted SLRs, templates, contract details, internal notes, calendar entries, export history, email settings, and document metadata.

The actual uploaded document file bytes remain in browser IndexedDB until the next storage-migration release.

## Part 5 — Verification in Supabase

In Supabase Table Editor, verify that records appear in:

- `projects`
- `customers`
- `contacts`
- `slr_entries`
- `slr_templates`
- `project_documents`
- `import_runs`

Do not edit production records directly in the Table Editor.
