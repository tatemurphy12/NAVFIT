# Exporting to PDF

NAVFIT26 fills the official Navy FITREP PDF template with the current report data.

---

## How to Export

1. Save the FITREP first — **Export PDF** is disabled until the report is saved with no pending changes.
2. Click **Export PDF** in the FITREP form.
3. A Save dialog opens. The default filename is based on the member's name (e.g., `Report_doe_john_q_.pdf`) and the default location is the Desktop.

---

## SSN Masking

When SSN encryption is enabled, SSN fields in the exported PDF appear as asterisks. To export with real SSNs, decrypt the database first (see [SSN Encryption](SSN-Encryption)).

---

## Notes

- The PDF template is the standard fillable NAVFIT form bundled with the application.
- Text fields use Courier font to match the form's layout.
- Long narrative blocks are automatically wrapped to fit within field boundaries.
- The output PDF is flat (non-fillable), ready for printing or digital submission.
