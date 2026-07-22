# ScopeLogic Revision 14.4

Revision 14.4 refines project document metadata, internal notes, export tracking, PDF version metadata, and official GC release packaging.

## Key changes

- Project Document details now use a local editing draft and require **Save Details**.
- Display Name, Document Type, Revision, Issue Date, Current status, and Notes persist only after Save Details.
- Current Document is a checkbox independent of the Revision text.
- Project Setup and all generated PDFs use **Version Date** instead of Bid Date.
- Contractor Checklist dropdown and Reason form text is reduced to align with the document body font.
- Export Log records actual PDF download events, not PDF generation/update events.
- Added project-specific Internal Notes with one large scrolling text area.
- Added **Generate All PDFs** / **Generate All PDFs for GC**.
- Official releases download one combined PDF containing:
  1. ScopeLogic cover page
  2. Recommended SOW Matrix
  3. Clarification Matrix
  4. Formal RFI
  5. Contractor Response Checklist
  6. Snippet Register
- The cover page includes ScopeLogic LLC branding, project/client, document revision, version date, and included deliverables.
- Individual PDF generation, preview, update, and download controls remain available.

## Deploy

Upload the extracted project files to the GitHub repository and commit to `main`. Vercel should redeploy automatically.
