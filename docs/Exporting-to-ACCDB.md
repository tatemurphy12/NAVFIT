# Exporting to ACCDB

NAVFIT26 can export an entire database to a Microsoft Access `.accdb` file compatible with NAVFIT98A.

---

## How to Export

The ACCDB export can be triggered from two places:

**From the FITREP form:**
1. Save the FITREP first — the **Export ACCDB** button is disabled until the report is saved and has no unsaved changes.
2. Click **Export ACCDB**.

**From the opened database view (Home Page):**
1. Open a database from the Home Page.
2. Click **↓ Export ACCDB**.

In both cases, a Save dialog opens — choose a filename and location. The default location is your Desktop.

> The export includes **all reports** in the active database, not just the currently open FITREP.

---

## How It Works

NAVFIT26 bundles a Java converter (`app.jar`) that uses the [UCanAccess](http://ucanaccess.sourceforge.net/) and [Jackcess](https://jackcess.sourceforge.io/) libraries to write a NAVFIT98-compatible `.accdb` file. A bundled JRE is included — no Java installation is required on your machine.

The export process:
1. Stages the database data into a clean intermediate SQLite file.
2. Invokes `app.jar` via the bundled JRE to convert it to `.accdb` format.
3. Cleans up the staging database to prevent duplication on subsequent exports.

---

## SSN Encryption Restriction

If SSN encryption is active, clicking **Export ACCDB** opens a password prompt. Entering the correct password decrypts the SSNs and immediately triggers the export. This prevents accidentally exporting masked SSN values into a NAVFIT98 database.

---

## Compatibility Notes

- The output `.accdb` schema matches the NAVFIT98 table structure.
- Folder hierarchy is preserved in the `Folders` table.
- If NAVFIT98 cannot open the file, verify that your NAVFIT98A installation is up to date.
