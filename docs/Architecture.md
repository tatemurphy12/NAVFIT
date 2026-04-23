# Architecture

NAVFIT26 is an [Electron](https://www.electronjs.org/) desktop application with a React frontend and a Node.js/SQLite backend. The three layers communicate through a secure IPC bridge.

---

## Layer Overview

```
┌─────────────────────────────────────┐
│         Renderer Process            │
│   React + Vite (frontend2.1/)       │
│   Pages: HomePage, FitrepForm       │
└──────────────┬──────────────────────┘
               │ window.api.*  (IPC)
┌──────────────▼──────────────────────┐
│         Preload Bridge              │
│   electron2.1/preload.js            │
│   Context isolation — exposes only  │
│   named channels to the renderer    │
└──────────────┬──────────────────────┘
               │ ipcMain.handle(channel, ...)
┌──────────────▼──────────────────────┐
│         Main Process                │
│   electron2.1/main.js              │
│   - IPC handlers (CRUD, export)     │
│   - SQLite via better-sqlite3       │
│   - PDF generation via pdf-lib      │
│   - Java converter for .accdb       │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
  SQLite DB           Java JAR
  (better-sqlite3)    (UCanAccess/Jackcess)
  Local .db file      → .accdb output
```

---

## IPC Communication

The renderer never has direct access to Node.js APIs. All operations go through named IPC channels defined in `preload.js` and handled in `main.js`:

| Channel | Purpose |
|---|---|
| `save-fitrep` | Write or update a FITREP record |
| `loadFitreps` | Fetch all reports in a database |
| `loadFitrep` | Fetch a single report by ID |
| `deleteFitrep` | Remove a report by ID |
| `generate-report` | Generate and save a filled PDF |
| `export-accdb` | Trigger Java converter for .accdb export |
| `exportDb` | Copy the SQLite database file |
| `getDatabases` | List tracked databases |
| `createDatabase` | Create a new database from template |
| `uploadDatabase` | Import an existing `.db`, `.sqlite`, or `.accdb` file |
| `removeDatabase` | Remove a database from the tracked list |
| `getRaterGroupSummary` | Compute group averages and promo counts |
| `getDbSsnState` | Check whether SSNs are encrypted |
| `encryptSSNs` | Encrypt SSN fields in a database |
| `decryptSSNs` | Decrypt SSN fields in a database |
| `update-menu-style` | Switch Electron menu between default and fitrep modes |

---

## Data Flow — Saving a FITREP

1. User clicks **Save Changes** or triggers save via the Electron menu (Ctrl+S routes through `menu-save-trigger` IPC).
2. `useFitrep.js` calls `window.api.saveFitrep(data)`.
3. `preload.js` forwards this over the `save-fitrep` channel.
4. `main.js` runs an `INSERT` for new reports or `UPDATE` for existing ones against the `Reports` table.
5. The new `ReportID` is returned to the renderer and stored in form state.

## Data Flow — Exporting to ACCDB

1. User clicks **Export ACCDB** (in the FITREP form or the Home Page database view).
2. Main process stages the entire database into a clean intermediate SQLite file.
3. Main process spawns the bundled JRE with `app.jar`, passing the staging DB path and a user-selected output path.
4. `app.jar` reads the staging DB via UCanAccess and writes a NAVFIT98-compatible `.accdb` file.
5. Staging database is deleted to prevent duplication on subsequent exports.

---

## Key Files

| File | Purpose |
|---|---|
| `electron2.1/main.js` | All IPC handlers, DB logic, export orchestration (~40KB) |
| `electron2.1/preload.js` | Secure IPC bridge — defines `window.api` |
| `backend2.1/src/FitRepData.js` | Data class with all FITREP fields |
| `backend2.1/src/FitRepMapper.js` | Maps FitRepData fields to PDF form field names |
| `backend2.1/src/PdfFiller.js` | Low-level PDF filling using pdf-lib |
| `frontend2.1/src/hooks/useFitrep.js` | React hook managing form state and IPC calls |
| `frontend2.1/src/utils/formatters.jsx` | Field validators and display formatters |
| `frontend2.1/src/constants/fitrepConfig.jsx` | Trait definitions and config constants |
| `electron2.1/bin/app.jar` | Java converter for .accdb output |
