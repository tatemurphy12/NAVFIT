# Data Model

FITREP data is stored in the `Reports` SQLite table. The `FitRepData` class (`backend2.1/src/FitRepData.js`) defines the field structure used for PDF generation. The fields below reflect what is read and written by the current save handler in `main.js`.

---

## Personal & Admin

| DB Field | Notes |
|---|---|
| `FullName` | Last, First MI Suffix |
| `FirstName`, `MI`, `LastName`, `Suffix` | Split from FullName on save |
| `Rate` | Grade/rate (e.g., `LT`) |
| `Desig` | Designator code; max 4 digits |
| `SSN` | 9-digit SSN; field-level encrypted when encryption is enabled |
| `UIC` | Unit Identification Code; max 5 digits |
| `ShipStation` | Ship or station name |
| `PromotionStatus` | REGULAR, FROCKED, SELECTED, or SPOT |
| `DateReported` | Date reported to command (YYMMMDD, e.g., `26APR23`) |

## Duty Status

Stored as separate integer columns (0/1). Only one should be 1 at a time.

| DB Field | UI Label |
|---|---|
| `Active` | ACT |
| `TAR` | FTS |
| `Inactive` | INACT |
| `ATADSW` | AT/ADSW/ |

## Occasion for Report

| DB Field | UI Label |
|---|---|
| `Periodic` | Periodic |
| `DetInd` | Detachment of Individual |
| `Frocking` | Detachment of Reporting Senior |
| `Special` | Special |
| `NOB` | Not Observed Report |

## Type of Report

| DB Field | UI Label |
|---|---|
| `Regular` | Regular |
| `Concurrent` | Concurrent |
| `OpsCdr` | Ops Cdr |

## Period of Report

| DB Field | Notes |
|---|---|
| `FromDate` | Start date (YYMMMDD) |
| `ToDate` | End date (YYMMMDD) |

## Physical & Billet

| DB Field | Notes |
|---|---|
| `PhysicalReadiness` | Physical readiness code |
| `BilletSubcat` | Billet subcategory (e.g., `OIC`, `INDIV AUG`) |

## Reporting Senior

| DB Field | Notes |
|---|---|
| `ReportingSenior` | Full name (Last, First MI Suffix) |
| `RSGrade` | Grade (e.g., `CDR`) |
| `RSDesig` | Designator |
| `RSTitle` | Title (e.g., `CO`) |
| `RSUIC` | UIC |
| `RSSSN` | SSN |
| `RSAddress` | Command address |

## Duties & Achievements

| DB Field | Notes |
|---|---|
| `Achievements` | Block 28 — Command employment and achievements |
| `PrimaryDuty` | Block 29 abbreviation box (e.g., `DIVO`) |
| `Duties` | Block 29 full duty description |

## Counseling

| DB Field | Notes |
|---|---|
| `DateCounseled` | Date of mid-term counseling |
| `Counseler` | Name of counselor |

## Performance Traits

Stored as integers (1–5) or 0 if blank/NOB. `QUAL` and `PA` are legacy NAVFIT98 columns always saved as 0.

| DB Field | UI Block | Trait Name |
|---|---|---|
| `PROF` | 33 | Professional Expertise |
| `EO` | 34 | Command or Organizational Climate / Equal Opportunity |
| `MIL` | 35 | Military Bearing / Character |
| `TEAM` | 36 | Teamwork |
| `MIS` | 37 | Mission Accomplishment and Initiative |
| `LEAD` | 38 | Leadership |
| `TAC` | 39 | Tactical Performance (optional) |
| `QUAL` | — | Legacy; always 0 |
| `PA` | — | Legacy; always 0 |

The Member Trait Average is computed on the fly and is not stored.

## Recommendations & Comments

| DB Field | Notes |
|---|---|
| `RecommendA` | Block 40 — First career milestone recommendation |
| `RecommendB` | Block 40 — Second career milestone recommendation |
| `Comments` | Block 41 — Comments on performance |

## Promotion Recommendation

| DB Field | Notes |
|---|---|
| `PromotionRecom` | Block 42 individual recommendation (integer; see table below) |

| DB Value | UI Label |
|---|---|
| 0 | NOB |
| 1 | SIGNIFICANT PROBLEMS |
| 2 | PROGRESSING |
| 3 | PROMOTABLE |
| 4 | MUST PROMOTE |
| 5 | EARLY PROMOTE |

## Metadata

| DB Field | Notes |
|---|---|
| `ReportID` | Auto-assigned primary key (SQLite rowid) |

---

## Fields Not Saved by the Current Form

The following columns exist in the DB schema (for NAVFIT98 compatibility or future use) but are not written by the current save handler:

- **Summary counts** (`SummarySP`, `SummaryProg`, `SummaryProm`, `SummaryMP`, `SummaryEP`, `SummaryNOB`) — Block 43 counts shown in the form are computed dynamically from all reports in the database via `getRaterGroupSummary`, not stored per-report.
- **`RSCA`** — Summary Group Average; computed dynamically, not stored.
- **`StatementYes` / `StatementNo`** — Statement of intent radio buttons exist in the form (Block 46) but the selection is not persisted to the database.
- **`RRSName`, `RRSGrade`, `RRSCommand`, `RRSUIC`** — Block 47 concurrent report senior fields; exist in `FitRepData` but not in the save handler.

---

## SQLite Schema

The `Reports` table contains one row per FITREP. The schema is defined in `electron2.1/templates/database_template.db`. The `Folders` table stores a NAVFIT98-compatible folder hierarchy. The `Summary` table is reserved for future use.
