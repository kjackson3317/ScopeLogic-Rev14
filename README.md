# ScopeLogic Revision 14.3

Focused refinement of the Revision 14 application.

## Revision 14.3 changes

- Replaces browser alert, prompt, and confirm dialogs with branded in-app dialogs.
- Adds project status and multi-system dropdown controls.
- Adds document-type dropdowns for Drawings, Specifications, Addendums, Revisions, Narratives, General Bid Documents, and Contractor Checklist.
- Adds project document uploads with browser-persistent IndexedDB file storage.
- Rebuilds Project Documents as a Windows Explorer-style workspace with Project Documents and Previous Documents folders.
- Adds Replace Revision workflow that moves superseded files to Previous Documents.
- Shows RFI number below SLR number in the Clarification Matrix when applicable.
- Rebuilds PDF table grid calculations so borders share exact coordinates and column widths match the printable area.
- Restores standardized ScopeLogic LLC PDF headers, company mark, project metadata, revision, and standardized footer.
- Adds contractor checklist instruction note and taller multiline editable response-reason fields.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Upload the repository contents to GitHub. Vercel will detect Next.js and run `npm run build`.
