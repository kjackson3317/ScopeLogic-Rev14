# Contractor Checklist PDF Form Fix

**Revision:** 14.5.1

The Contractor Response Checklist previously called `setFontSize(6)` before the dropdown and Reason widgets were added to the PDF page. In pdf-lib, `setFontSize` requires an existing `/DA` (default appearance) entry, which is generated when `addToPage` creates the widget appearance.

The corrected order is:

1. Create the field.
2. Add options/value.
3. Add the widget to the page with the embedded Helvetica font.
4. Set the 6 pt font size.
5. Regenerate the field appearance stream.

This resolves:

```
No /DA (default appearance) entry found for field: checklist_response_*
```
