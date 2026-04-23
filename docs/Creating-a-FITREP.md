# Creating a FITREP

## Opening the Form

From the opened database view, click **+ Add Report** to open a blank form, or click **Edit / View** next to an existing report to edit it.

---

## Section Breakdown

### Block 1 — Name
Last, First MI Suffix (auto-uppercased; letters, commas, spaces, and hyphens only).

### Block 2 — Grade/Rate
Member's rate or rank (e.g., `LT`, `ENS`).

### Block 3 — Desig
Designator code (digits only, max 4 characters).

### Block 4 — SSN
9 digits. Displayed as bullets if SSN encryption is enabled (see [SSN Encryption](SSN-Encryption)).

### Block 5 — Duty Status
Radio button — select one: **ACT**, **FTS**, **INACT**, or **AT/ADSW/**.

### Block 6 — UIC
Unit Identification Code (digits only, max 5 characters).

### Block 7 — Ship/Station
Command name (auto-uppercased).

### Block 8 — Promotion Status
Dropdown — select one: REGULAR, FROCKED, SELECTED, or SPOT.

### Block 9 — Date Reported
Click to open a date picker; stored and displayed in Navy format (YYMMMDD, e.g., `26APR23`).

### Blocks 10–13 — Occasion for Report
Radio button — select one:
- **Periodic**
- **Detachment of Individual**
- **Detachment of Reporting Senior**
- **Special**

### Block 14–15 — Period of Report
From and To dates, entered via date picker; stored in Navy format (YYMMMDD).

### Block 16 — Not Observed
Radio button — check if this is a Not Observed report.

### Blocks 17–19 — Type of Report
Radio button — select one: **Regular**, **Concurrent**, or **Ops Cdr**.

### Block 20 — Physical Readiness
Text field for physical readiness code.

### Block 21 — Billet Subcategory
Dropdown with standard Navy billet subcategory codes.

### Block 22–27 — Reporting Senior
| Block | Field |
|---|---|
| 22 | Reporting Senior name (Last, First MI Suffix) |
| 23 | Senior grade |
| 24 | Senior designator |
| 25 | Senior title |
| 26 | Senior UIC |
| 27 | Senior SSN (shown as bullets if encrypted) |

### Block 28 — Command Employment and Achievements
Free-text area for command-level employment and achievements. Max 276 characters.

### Block 29 — Primary/Collateral/Watchstanding Duties
Short abbreviation box for the primary duty (e.g., `DIVO`) plus a larger text area for full duty description.

### Blocks 30–31 — Counseling
Date counseled (supports NOT REQ / NOT PERF dropdown options) and counselor name.

### Blocks 33–39 — Performance Traits
Seven scored traits. See [Performance Traits](Performance-Traits) for rating guidance and descriptions.

### Block 40 — Milestone Screening Recommendations
Up to two career milestone recommendations (e.g., `DEPT HEAD`, `PG SCHOOL`).

### Block 41 — Comments on Performance
Free-text narrative. Limited to 18 lines. A live line counter is displayed; text beyond 18 lines is not visible in the printed form.

### Block 42 — Individual Promotion Recommendation
Radio button — select one of six options. See [Performance Traits](Performance-Traits) for tier definitions.

### Block 43 — Summary Group Counts
Read-only. Auto-computed from all reports in the active database. Shows a count at each promotion tier. These values are not stored per-report.

### Block 44 — Reporting Senior Address
Free-text address for the reporting senior's command.

### Block 46 — Statement of Intent
Radio button — select whether the member intends to submit a statement. **Note:** this selection is not currently saved to the database.

---

## Saving

Click **Save Changes** or press **Ctrl+S** (via the menu) to write the report to the database. A unique Report ID is assigned on first save.

---

## Exporting

The **Export PDF** and **Export ACCDB** buttons are disabled until the report has been saved and all changes are current. See:
- [Exporting to PDF](Exporting-to-PDF)
- [Exporting to ACCDB](Exporting-to-ACCDB)
