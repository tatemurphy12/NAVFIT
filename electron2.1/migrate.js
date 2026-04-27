/**
 * migrate.js
 * Run once to add StatementYes and StatementNo to an existing Reports table.
 * These two columns are required for field 46 (Statement Intent) to persist
 * correctly when a saved report is exported to PDF.
 *
 * Usage: node migrate.js /path/to/your/database.db
 *
 * Safe to run multiple times — skips columns that already exist.
 */

const Database = require('better-sqlite3');

const dbPath = process.argv[2];
if (!dbPath) {
    console.error('Usage: node migrate.js /path/to/your/database.db');
    process.exit(1);
}

const db = new Database(dbPath);

const newColumns = [
    { name: 'StatementYes', type: 'INTEGER DEFAULT 0' },
    { name: 'StatementNo',  type: 'INTEGER DEFAULT 0' },
];

const existingCols = db.pragma('table_info(Reports)').map(c => c.name);

let added = 0;
for (const col of newColumns) {
    if (!existingCols.includes(col.name)) {
        db.prepare(`ALTER TABLE [Reports] ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`Added column: ${col.name}`);
        added++;
    } else {
        console.log(`Already exists, skipped: ${col.name}`);
    }
}

db.close();
console.log(`\nDone. ${added} column(s) added.`);