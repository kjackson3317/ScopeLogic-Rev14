# ScopeLogic Revision 14.8

Revision 14.8 corrects the Internal Matrix checklist workflow, removes the global New SLR shortcut, improves email configuration diagnostics, clears transient new-entry fields after saving, and replaces the logo-only Standards page with operating standards.

## Included updates

- Removed the New SLR button from the global top toolbar. New issues are created only from the Internal Matrix.
- Replaced the separate Internal Matrix checklist checkbox with a Contractor Checklist Scope Item text field.
- Text in Contractor Checklist Scope Item is the exact scope language shown in the editable checklist PDF.
- Leaving Contractor Checklist Scope Item blank excludes the SLR from the checklist.
- Existing Revision 14.7 checklist assignments migrate their prior Scope Item text into the new checklist field.
- New SLR submissions clear the editor and open a blank provisional entry for the next SLR.
- Calendar milestone entry text continues to clear after saving.
- Successful email delivery closes the composer before the Sent confirmation appears.
- Email Settings now reports whether the server has a Resend key and whether its format is plausible.
- Invalid-key responses now provide direct Vercel/Resend correction instructions.
- ScopeLogic Standards is now an operating-reference page covering numbering, submissions, templates, field-to-deliverable mapping, checklist rules, document control, releases, email, PDFs, and logo usage.

## Email configuration correction

The in-app approved sender list does not replace the provider API key. A valid `RESEND_API_KEY` must be configured in Vercel.

1. Create or copy a current complete API key from the Resend dashboard.
2. In Vercel, open Project Settings → Environment Variables.
3. Replace `RESEND_API_KEY` in every active environment that will send email, typically Production and Preview.
4. Confirm the From-address domain is verified with Resend.
5. Redeploy the project.
6. Open Email Settings and select Refresh Status.

## Deployment

1. Replace the repository files with this package.
2. Commit to the branch connected to Vercel.
3. Confirm the email environment variables.
4. Redeploy.
