# ScopeLogic Revision 14.2 - Workflow and PDF Correction Release

## Corrections
- New projects begin blank at SLR-001.
- No preloaded templates. Save any SLR as an individually selectable template.
- Internal Matrix uses draft + Submit Entry workflow.
- SLR, RFI, and snippet numbers are generated automatically and renumber after deletion.
- Static sample PDFs were removed from the workflow.
- Generate/Update PDF uses the current submitted project data.
- PDF table text wraps inside fixed cell widths and creates new pages as needed.
- Contractor Response Checklist generates as an editable AcroForm PDF with dropdowns and multiline reason fields.
- Redundant SLR Reference Register removed from navigation.

## Deploy
Upload all files to the GitHub repository root and redeploy in Vercel. Vercel will install `pdf-lib` during build.


## Revision 14.2.1 — Global SLR Template Library

- Saved SLR templates are stored globally rather than by project.
- Templates created in any project remain available in every other project.
- The Internal Matrix now provides a template dropdown with Use Template and Delete Template controls.
- New projects remain blank until the user creates an SLR or selects a saved template.
