# ScopeLogic Revision 14.7

Revision 14.7 refines the existing ScopeLogic application without replacing the approved workflow.

## Included updates

- Project Library calendar occupies the upper workspace and uses a responsive editor that does not require horizontal scrolling.
- Projects appear below the calendar in a compact list view.
- Dashboard current drawings are limited to a compact 3–5 drawing panel.
- Dashboard details use Contract and Contacts tabs.
- Customer Database and contact address book persist globally across projects.
- Project Setup can select a saved customer.
- Email delivery can select recipients from the global contact address book.
- Approved sender addresses are editable in Email Settings and are passed to the server email route.
- Internal Matrix includes a prominent Include on Contractor Response Checklist control.
- Contractor Checklist PDF fields use compact dynamic row heights; multiline Reason fields scroll when additional text exceeds the visible field.
- Generate All PDFs and Email All PDFs open an in-app deliverable-selection dialog.
- Official release cover pages list only the selected deliverables and can include a release note.
- Save actions display an in-app Saved confirmation; successful email delivery displays Sent.

## Deployment

1. Upload all files in this package to the GitHub repository.
2. Commit to the branch connected to Vercel.
3. Confirm the existing email environment variables remain configured.
4. Redeploy.

## Email configuration

The application stores the default and approved sender list locally. The email provider must still verify the sender domain. `SCOPELOGIC_ALLOWED_FROM_EMAILS` remains optional as a server-side supplemental list.
