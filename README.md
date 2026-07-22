# ScopeLogic Revision 14.5

Revision 14.5 retains the Revision 14.4 workflow and adds direct PDF email delivery, a dedicated Formal RFI Question field, repaired individual/combined PDF generation, and the official ScopeLogic logo system.

## Major changes

- Dedicated `Formal RFI Question` field in the ScopeLogic Internal Matrix.
- Formal RFI deliverables use the RFI Question field; Scope Concern remains the internal and Clarification Matrix issue statement.
- Individual PDF pages include the approved ScopeLogic mark and wordmark.
- The official combined GC release uses the full ScopeLogic logo on its cover.
- The combined release is produced in one PDF document, including the editable Contractor Response Checklist fields.
- `Email PDF` is available on each deliverable page.
- `Email All PDFs` creates and sends the official combined GC release package.
- Email Settings supports a default sender, additional selectable sender addresses, and a default Reply-To address.
- The ScopeLogic Standards page documents the uploaded logo as the official logo moving forward.

## Email configuration

The app uses Resend from a Next.js server route. Add the following Vercel Environment Variables before using direct email delivery:

```text
RESEND_API_KEY=re_xxxxxxxxx
SCOPELOGIC_DEFAULT_FROM_EMAIL=ScopeLogic LLC <deliverables@your-verified-domain.com>
SCOPELOGIC_ALLOWED_FROM_EMAILS=deliverables@your-verified-domain.com,estimating@your-verified-domain.com
SCOPELOGIC_DEFAULT_REPLY_TO=yourname@your-domain.com
```

`SCOPELOGIC_ALLOWED_FROM_EMAILS` and `SCOPELOGIC_DEFAULT_REPLY_TO` are optional. Sender domains must be verified with the configured email provider. The in-app From field may be left blank to use `SCOPELOGIC_DEFAULT_FROM_EMAIL`.

## Deployment

1. Replace the existing GitHub repository files with this package.
2. Add the email environment variables in Vercel Project Settings.
3. Redeploy the `main` branch.
4. Open Email Settings in the application and save the preferred sender addresses.

## Brand governance

See `OFFICIAL-LOGO-STANDARD.md`. The original uploaded artwork is stored at `public/brand/scopelogic-official-logo-source.png`.
