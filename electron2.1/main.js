const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const Database = require('better-sqlite3');

const IS_PROD = app.isPackaged;
const BASE_DIR = __dirname;
const PROJECT_ROOT = BASE_DIR;

const FitRepData = IS_PROD 
    ? require('./backend_src/FitRepData') 
    : require('../backend2.1/src/FitRepData');

const FitRepMapper = IS_PROD 
    ? require('./backend_src/FitRepMapper') 
    : require('../backend2.1/src/FitRepMapper');

const PdfFiller = IS_PROD 
    ? require('./backend_src/PdfFiller') 
    : require('../backend2.1/src/PdfFiller');

// --- 1. CONFIGURATION & PATHS ---
// Java Paths

// Detect platform and pick the matching bundled JRE folder.
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';
const javaExecutable = isWin ? 'java.exe' : 'java';
const jreDirName = isWin ? 'jre-win' : isLinux ? 'jre-linux' : 'jre-mac';

// Java Paths
const JAVA_BIN = IS_PROD
    ? path.join(process.resourcesPath, 'bin', jreDirName, 'bin', javaExecutable)
    : path.join(BASE_DIR, 'bin', jreDirName, 'bin', javaExecutable);

const JAR_PATH = IS_PROD
    ? path.join(process.resourcesPath, 'bin', 'app.jar')
    : path.join(BASE_DIR, 'bin', 'app.jar');

// PDF Template Path
const PDF_TEMPLATE = IS_PROD
    ? path.join(process.resourcesPath, 'templates', 'navfit_fitrep_report_fillable_template.pdf')
    : path.join(PROJECT_ROOT, 'templates', 'navfit_fitrep_report_fillable_template.pdf');

// --- 1. DYNAMIC USER PATHS ---
const DOCUMENTS_DIR = app.getPath('documents');
const USER_DATA_DIR = app.getPath('userData');

// Dev = local project folder. Prod = user's Documents folder.
const INTERNAL_DATA_DIR = IS_PROD
    ? path.join(USER_DATA_DIR, 'working_data')
    : path.join(BASE_DIR, 'working_data');

const OUTWARD_DIR = IS_PROD
    ? path.join(DOCUMENTS_DIR, 'NavFit_Output')
    : path.join(BASE_DIR, 'output_files');

// 3. ENSURE DIRECTORIES EXIST
[OUTWARD_DIR, INTERNAL_DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});
// --- NEW: HOMEPAGE DATABASE TRACKING ---
const DATABASES_LIST_PATH = path.join(app.getPath('userData'), 'databases.json');

function getDatabasesList() {
    if (!fs.existsSync(DATABASES_LIST_PATH)) {
        return [];
    }
    try {
        const list = JSON.parse(fs.readFileSync(DATABASES_LIST_PATH, 'utf-8'));
        // Migrate existing entries to include ssnState and ssnPassword
        let needsSave = false;
        for (const db of list) {
            if (db.ssnState === undefined) {
                db.ssnState = 'decrypted';
                db.ssnPassword = null;
                needsSave = true;
            }
        }
        if (needsSave) {
            fs.writeFileSync(DATABASES_LIST_PATH, JSON.stringify(list));
        }
        return list;
    } catch (err) {
        return [];
    }
}

function saveDatabasesList(list) {
    fs.writeFileSync(DATABASES_LIST_PATH, JSON.stringify(list));
}

// 4. DEFAULTS MAPPING
const DEFAULTS = {
    ACCDB_IN: IS_PROD
        ? path.join(process.resourcesPath, 'bin', 'Murphy_example_FITREP.accdb')
        : path.join(BASE_DIR, 'bin', 'Murphy_example_FITREP.accdb'),
        
    SQLITE: path.join(INTERNAL_DATA_DIR, 'migrated_reports.db'),
    
    ACCDB_OUT: path.join(OUTWARD_DIR, 'Generated_FITREP.accdb'),
    PDF_OUT_DIR: OUTWARD_DIR
};

// --- DATABASE SEEDING LOGIC ---
const SQLITE_TEMPLATE = IS_PROD
    ? path.join(process.resourcesPath, 'templates', 'database_template.db')
    : path.join(PROJECT_ROOT, 'templates', 'database_template.db');

// --- 2. DATABASE LOGIC (Java Required) ---
async function runExportLogic(source, target) {
    const input = source || DEFAULTS.ACCDB_IN;
    const output = target || DEFAULTS.SQLITE;
    const outDir = path.dirname(output);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    return await runJava(['export', input, output]);
}

async function runImportLogic(source, target) {
    const input = source || DEFAULTS.SQLITE;
    const output = target || DEFAULTS.ACCDB_OUT;
    const outDir = path.dirname(output);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    return await runJava(['import', input, output]);
}

function runJava(args) {
    return new Promise((resolve, reject) => {
        execFile(JAVA_BIN, ['-jar', JAR_PATH, ...args], (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout);
            }
        });
    });
}

// --- 3. REPORT LOGIC (Pure JS) ---
async function runReportLogic(inputData, pdfOutPath) {
    let dataModel = inputData ? new FitRepData(inputData) : FitRepData.mock();
    const safeName = (dataModel.FullName || "Draft_Report").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const finalPdfPath = pdfOutPath || path.join(DEFAULTS.PDF_OUT_DIR, `Report_${safeName}.pdf`);
    const jsonTempPath = path.join(INTERNAL_DATA_DIR, `temp_data_${safeName}_${Date.now()}.json`);

    const mapper = new FitRepMapper();
    mapper.mapDataModel(dataModel);
    mapper.exportJson(jsonTempPath);

    if (!fs.existsSync(PDF_TEMPLATE)) throw new Error(`PDF Template missing at: ${PDF_TEMPLATE}`);
    await PdfFiller.fill(mapper.pdfMap, PDF_TEMPLATE, finalPdfPath);
    
    return finalPdfPath;
}

// --- DATABASE RECORD HANDLERS (READ / WRITE / DELETE) ---


ipcMain.handle('save-fitrep', async (e, payload) => {
    const { data, dbPath, reportId } = payload;
    const targetDb = dbPath || DEFAULTS.SQLITE;

    try {
        const db = new Database(targetDb);

        // Ensure the Folders table has a Root entry (Required for legacy NAVFIT compatibility)
        const rootExists = db.prepare("SELECT FolderID FROM [Folders] WHERE FolderID = 1").get();
        if (!rootExists) {
            db.prepare(`INSERT INTO [Folders] (FolderName, FolderID, Parent, Active) VALUES (?, ?, ?, ?)`).run('Root', 1, 0, 1);
        }

        // If SSNs are encrypted, preserve the encrypted values from the database
        // instead of overwriting with plaintext or masked values from the frontend
        const encrypted = isDbEncrypted(targetDb);
        console.log(`[save-fitrep] dbPath=${targetDb}, reportId=${reportId}, encrypted=${encrypted}, incoming SSN="${data.SSN?.substring(0, 20)}", RSSSN="${data.RSSSN?.substring(0, 20)}"`);
        if (encrypted && reportId) {
            const existing = db.prepare('SELECT SSN, RSSSN FROM [Reports] WHERE ReportID = ?').get(reportId);
            if (existing) {
                console.log(`[save-fitrep] PRESERVING encrypted SSN="${existing.SSN?.substring(0, 20)}", RSSSN="${existing.RSSSN?.substring(0, 20)}"`);
                data.SSN = existing.SSN;
                data.RSSSN = existing.RSSSN;
            }
        }

        if (!reportId) {
            // -- ADD NEW REPORT (INSERT) --
            const reportStmt = db.prepare(`
                INSERT INTO [Reports] (
                    Parent, ReportType, FullName, FirstName, MI, LastName, Suffix,
                    Rate, Desig, SSN, Active, TAR, Inactive, ATADSW, UIC, ShipStation, 
                    PromotionStatus, DateReported, Periodic, DetInd, Frocking, Special, 
                    FromDate, ToDate, NOB, Regular, Concurrent, OpsCdr, 
                    ReportingSenior, RSGrade, RSDesig, RSTitle, RSUIC, RSSSN, RSAddress,
                    Achievements, PrimaryDuty, Duties, DateCounseled, Counseler,
                    PROF, QUAL, EO, MIL, PA, TEAM, LEAD, MIS, TAC,
                    RecommendA, RecommendB, Comments, PromotionRecom,
                    StatementYes, StatementNo
                ) VALUES (
                    'a 1', @ReportType, @FullName, @FirstName, @MI, @LastName, @Suffix,
                    @Rate, @Desig, @SSN, @Active, @TAR, @Inactive, @ATADSW, @UIC, @ShipStation,
                    @PromotionStatus, @DateReported, @Periodic, @DetInd, @Frocking, @Special,
                    @FromDate, @ToDate, @NOB, @Regular, @Concurrent, @OpsCdr,
                    @ReportingSenior, @RSGrade, @RSDesig, @RSTitle, @RSUIC, @RSSSN, @RSAddress,
                    @Achievements, @PrimaryDuty, @Duties, @DateCounseled, @Counseler,
                    @PROF, @QUAL, @EO, @MIL, @PA, @TEAM, @LEAD, @MIS, @TAC,
                    @RecommendA, @RecommendB, @Comments, @PromotionRecom,
                    @StatementYes, @StatementNo
                )
            `);
            const result = reportStmt.run(data);
            db.close();
            return { success: true, reportId: result.lastInsertRowid };
        } else {
            // -- EDIT EXISTING REPORT (UPDATE) --
            data.ReportID = reportId;
            const updateStmt = db.prepare(`
                UPDATE [Reports] SET 
                    ReportType=@ReportType, FullName=@FullName, FirstName=@FirstName, MI=@MI, LastName=@LastName, Suffix=@Suffix,
                    Rate=@Rate, Desig=@Desig, SSN=@SSN, Active=@Active, TAR=@TAR, Inactive=@Inactive, ATADSW=@ATADSW, UIC=@UIC, ShipStation=@ShipStation, 
                    PromotionStatus=@PromotionStatus, DateReported=@DateReported, Periodic=@Periodic, DetInd=@DetInd, Frocking=@Frocking, Special=@Special, 
                    FromDate=@FromDate, ToDate=@ToDate, NOB=@NOB, Regular=@Regular, Concurrent=@Concurrent, OpsCdr=@OpsCdr, 
                    ReportingSenior=@ReportingSenior, RSGrade=@RSGrade, RSDesig=@RSDesig, RSTitle=@RSTitle, RSUIC=@RSUIC, RSSSN=@RSSSN, RSAddress=@RSAddress,
                    Achievements=@Achievements, PrimaryDuty=@PrimaryDuty, Duties=@Duties, DateCounseled=@DateCounseled, Counseler=@Counseler,
                    PROF=@PROF, QUAL=@QUAL, EO=@EO, MIL=@MIL, PA=@PA, TEAM=@TEAM, LEAD=@LEAD, MIS=@MIS, TAC=@TAC,
                    RecommendA=@RecommendA, RecommendB=@RecommendB, Comments=@Comments, PromotionRecom=@PromotionRecom,
                    StatementYes=@StatementYes, StatementNo=@StatementNo
                WHERE ReportID = @ReportID
            `);
            updateStmt.run(data);
            db.close();
            return { success: true };
        }
    } catch (err) { 
        console.error("Save Error:", err);
        return { success: false, error: err.message }; 
    }
});

// Load all reports to display in the Homepage Table
ipcMain.handle('loadFitreps', async (event, dbPath) => {
    try {
        if (!fs.existsSync(dbPath)) return { error: "File not found" }; // Changed this line
        const db = new Database(dbPath, { readonly: true });
        const rows = db.prepare(`SELECT rowid as ReportID, FullName, Rate FROM [Reports] ORDER BY rowid DESC`).all();
        db.close();
        return rows;
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('removeDatabase', async (event, dbPath) => {
    try {
        let list = getDatabasesList();
        // Filter out the database that matches the provided path
        list = list.filter(db => db.path !== dbPath);
        saveDatabasesList(list);
        return { success: true };
    } catch (error) {
        console.error("Failed to remove database from list:", error);
        return { success: false, message: error.message };
    }
});

// Load a single report to pre-fill the form when "Edit" is clicked
ipcMain.handle('loadFitrep', async (e, { dbPath, reportId }) => {
    try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare(`SELECT *, rowid as ReportID FROM [Reports] WHERE rowid = ?`).get(reportId);
        db.close();
        return row;
    } catch (err) {
        console.error("Error loading Fitrep:", err);
        return null;
    }
});

// Delete a specific report
ipcMain.handle('deleteFitrep', async (e, { dbPath, reportId }) => {
    try {
        const db = new Database(dbPath);
        db.prepare(`DELETE FROM [Reports] WHERE rowid = ?`).run(reportId);
        db.close();
        return { success: true };
    } catch (err) {
        console.error("Error deleting Fitrep:", err);
        return { success: false, error: err.message };
    }
});

// Compute rater group summary from all reports in the database.
// Returns the summary group average (average of all member trait averages)
// and the count of each promotion recommendation category.
ipcMain.handle('getRaterGroupSummary', async (e, dbPath) => {
    try {
        if (!dbPath || !fs.existsSync(dbPath)) {
            return { error: "Database not found" };
        }
        const db = new Database(dbPath, { readonly: true });

        // Pull trait columns for every report
        const rows = db.prepare(`
            SELECT PROF, QUAL, EO, MIL, TEAM, LEAD, MIS, TAC, PromotionRecom
            FROM [Reports]
        `).all();
        db.close();

        if (!rows || rows.length === 0) {
            return {
                summaryGroupAverage: 'NAN',
                promoCounts: { sigProb: 0, prog: 0, promotable: 0, mustPromote: 0, earlyPromote: 0 }
            };
        }

        // 1. Compute each report's member trait average, then average them all
        const memberAverages = [];
        const promoCounts = { sigProb: 0, prog: 0, promotable: 0, mustPromote: 0, earlyPromote: 0 };

        for (const row of rows) {
            // Calculate individual member trait average
            const traits = [row.PROF, row.QUAL, row.EO, row.MIL, row.TEAM, row.LEAD, row.MIS, row.TAC];
            let sum = 0;
            let count = 0;
            for (const t of traits) {
                const val = parseFloat(t);
                if (!isNaN(val) && val > 0) {
                    sum += val;
                    count++;
                }
            }
            if (count > 0) {
                memberAverages.push(sum / count);
            }

            // 2. Tally promotion recommendation counts
            const promo = parseInt(row.PromotionRecom);
            if (promo === 1) promoCounts.sigProb++;
            else if (promo === 2) promoCounts.prog++;
            else if (promo === 3) promoCounts.promotable++;
            else if (promo === 4) promoCounts.mustPromote++;
            else if (promo === 5) promoCounts.earlyPromote++;
        }

        const summaryGroupAverage = memberAverages.length > 0
            ? (memberAverages.reduce((a, b) => a + b, 0) / memberAverages.length).toFixed(2)
            : 'NAN';

        return { summaryGroupAverage, promoCounts };
    } catch (err) {
        console.error("Error computing rater group summary:", err);
        return { error: err.message };
    }
});

// Export ACCDB (Java trigger)
// Creates a clean temporary SQLite copy with NAVFIT98-compatible structure,
// hands it to the Java converter, then cleans up the temp file.
ipcMain.handle('export-accdb', async (e, dbPath) => {
    let tempDbPath = null;
    try {
        if (!dbPath || !fs.existsSync(dbPath)) {
            throw new Error("No database found. Please open or create a database first.");
        }

        // Block export if SSNs are encrypted
        if (isDbEncrypted(dbPath)) {
            return { success: false, error: 'SSNs are currently encrypted. Please decrypt SSNs before exporting to ACCDB.' };
        }

        const defaultFileName = generateDynamicName(dbPath, 'accdb');

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Export ACCDB Database',
            defaultPath: path.join(app.getPath('desktop'), defaultFileName),
            filters: [{ name: 'Access Database', extensions: ['accdb'] }]
        });

        if (canceled || !filePath) return { success: false, error: "ACCDB Export cancelled." };

        // 1. Read all reports from the user's working database
        const sourceDb = new Database(dbPath, { readonly: true });
        const reports = sourceDb.prepare("SELECT * FROM [Reports]").all();
        sourceDb.close();

        if (!reports || reports.length === 0) {
            throw new Error("No reports found in database. Save a report before exporting.");
        }

        // 2. Create a clean temporary copy from the pristine template
        tempDbPath = path.join(INTERNAL_DATA_DIR, `accdb_staging_${Date.now()}.db`);
        fs.copyFileSync(SQLITE_TEMPLATE, tempDbPath);

        const tempDb = new Database(tempDbPath);

        // 3. Wipe all data to prevent folder/report duplication (NAVFIT98 requirement)
        tempDb.exec("DELETE FROM [Reports]; DELETE FROM [Folders]; DELETE FROM [Summary];");

        // 4. Create the "Root" container (FolderID 1)
        // NAVFIT98 requires this as the anchor for the navigation tree
        tempDb.prepare(`
            INSERT INTO [Folders] (FolderName, FolderID, Parent, Active)
            VALUES (?, ?, ?, ?)
        `).run('Root', 1, 0, 1);

        // 5. Re-insert each report with the exact schema NAVFIT98 expects
        const reportStmt = tempDb.prepare(`
            INSERT INTO [Reports] (
                Parent, ReportType, FullName, FirstName, MI, LastName, Suffix,
                Rate, Desig, SSN, Active, TAR, Inactive, ATADSW, UIC, ShipStation,
                PromotionStatus, DateReported, Periodic, DetInd, Frocking, Special,
                FromDate, ToDate, NOB, Regular, Concurrent, OpsCdr,
                ReportingSenior, RSGrade, RSDesig, RSTitle, RSUIC, RSSSN, RSAddress,
                Achievements, PrimaryDuty, Duties, DateCounseled, Counseler,
                PROF, QUAL, EO, MIL, PA, TEAM, LEAD, MIS, TAC,
                RecommendA, RecommendB, Comments, PromotionRecom,
                StatementYes, StatementNo
            ) VALUES (
                'a 1',
                @ReportType, @FullName, @FirstName, @MI, @LastName, @Suffix,
                @Rate, @Desig, @SSN, @Active, @TAR, @Inactive, @ATADSW, @UIC, @ShipStation,
                @PromotionStatus, @DateReported, @Periodic, @DetInd, @Frocking, @Special,
                @FromDate, @ToDate, @NOB, @Regular, @Concurrent, @OpsCdr,
                @ReportingSenior, @RSGrade, @RSDesig, @RSTitle, @RSUIC, @RSSSN, @RSAddress,
                @Achievements, @PrimaryDuty, @Duties, @DateCounseled, @Counseler,
                @PROF, @QUAL, @EO, @MIL, @PA, @TEAM, @LEAD, @MIS, @TAC,
                @RecommendA, @RecommendB, @Comments, @PromotionRecom,
                @StatementYes, @StatementNo
            )
        `);

        for (const report of reports) {
            // Normalize ReportType for legacy reports saved before this fix
            report.ReportType = 'FitRep';

            // Convert DATETIME columns from Navy format ("26MAR04") to ISO ("2026-03-04").
            // Java's JDBC parser cannot parse Navy strings and silently drops the entire record.
            for (const col of ['DateReported', 'FromDate', 'ToDate']) {
                report[col] = navyToISO(report[col]);
            }

            // Sanitize integer columns — older saves may contain NaN or null
            // from parseInt("NOB") which corrupts the ACCDB conversion.
            // The ACCDB schema requires proper integers (I23) for these columns.
            const intCols = [
                'PROF', 'QUAL', 'EO', 'MIL', 'PA', 'TEAM', 'LEAD', 'MIS', 'TAC',
                'PromotionRecom', 'SummaryRank',
                'Active', 'TAR', 'Inactive', 'ATADSW',
                'Periodic', 'DetInd', 'Frocking', 'Special',
                'NOB', 'Regular', 'Concurrent', 'OpsCdr',
                'RetentionYes', 'RetentionNo', 'StatementYes', 'StatementNo',
                'IsValidated'
            ];
            for (const col of intCols) {
                const val = report[col];
                if (val === undefined || val === null || val === '' || Number.isNaN(val) || Number.isNaN(Number(val))) {
                    report[col] = 0;
                } else {
                    report[col] = parseInt(val, 10) || 0;
                }
            }

            reportStmt.run(report);
        }

        tempDb.close();

        // 6. Hand the clean staging DB to the Java converter
        await runImportLogic(tempDbPath, filePath);

        console.log(`Successfully exported ACCDB to: ${filePath}`);
        return { success: true, path: filePath };

    } catch (err) {
        console.error("Export ACCDB Error:", err);
        return { success: false, error: err.message };
    } finally {
        // 7. Clean up the temporary staging database
        if (tempDbPath && fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch (_) {}
        }
    }
});

// Convert Navy date format ("26MAR04") to ISO ("2026-03-04") for Java/ACCDB compatibility.
// Java's JDBC date parser rejects Navy strings, causing the entire record to be silently dropped.
function navyToISO(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    // Already ISO: "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // Navy format: "YYMMM DD" e.g., "26MAR04"
    const months = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06',
                     JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' };
    if (s.length >= 7) {
        const year  = '20' + s.substring(0, 2);
        const month = months[s.substring(2, 5).toUpperCase()];
        const day   = s.substring(5, 7);
        if (month) return `${year}-${month}-${day}`;
    }
    return null;
}

// THE HELPER FUNCTION - Updated to accept dbPath
function generateDynamicName(dbPath, extension) {
    try {
        const db = new Database(dbPath, { readonly: true });
        // Grab the most recently added report to use for the file name
        const report = db.prepare("SELECT FullName, FirstName, LastName, UIC FROM [Reports] ORDER BY rowid DESC LIMIT 1").get();
        db.close();

        let namePart = "Draft";
        let uicPart = "NoUIC";

        if (report) {
            if (report.FullName) namePart = report.FullName;
            else if (report.LastName || report.FirstName) {
                namePart = `${report.LastName || ""}_${report.FirstName || ""}`.replace(/^_|_$/g, ''); 
            }
            uicPart = report.UIC || "NoUIC";
        }

        const safeName = `${namePart}_${uicPart}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return `FITREP_${safeName}.${extension}`;
        
    } catch (err) {
        return `Generated_FITREP.${extension}`; // Absolute foolproof fallback
    }
}

// Helper: check if a database has encrypted SSNs
function isDbEncrypted(dbPath) {
    const list = getDatabasesList();
    const entry = list.find(d => d.path === dbPath);
    return entry && entry.ssnState === 'encrypted';
}

// 3. Generate PDF
ipcMain.handle('generate-report', async (e, reportData) => {
    try {
        // If SSNs are encrypted, mask them with asterisks instead of blocking export
        if (reportData && reportData.dbPath && isDbEncrypted(reportData.dbPath)) {
            reportData.SSN = '***-**-****';
            reportData.RSSSN = '***-**-****';
        }

        // Pre-calculate the default name to show in the prompt
        let dataModel = reportData ? new FitRepData(reportData) : FitRepData.mock();
        const safeName = (dataModel.FullName || "Draft_Report").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const defaultPdfName = `Report_${safeName}.pdf`;

        // 1. Ask the user where to save
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save PDF Report',
            // Force it to the Desktop
            defaultPath: path.join(app.getPath('desktop'), defaultPdfName), 
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        // 2. Cancel if they close the window
        if (canceled || !filePath) return { success: false, error: "PDF Export cancelled." };

        // 3. Pass the explicitly chosen filePath to your logic
        const outPath = await runReportLogic(reportData, filePath);
        return { success: true, path: outPath };
    } catch (err) { 
        console.error("PDF Generation Error:", err);
        return { success: false, error: err.message }; 
    }
});

// --- NEW: HOMEPAGE FILE MANAGEMENT HANDLERS ---

ipcMain.handle('getDatabases', async () => {
    return getDatabasesList();
});

ipcMain.handle('getDbSsnState', async (event, dbPath) => {
    const list = getDatabasesList();
    const entry = list.find(d => d.path === dbPath);
    if (!entry) return { ssnState: 'decrypted', hasPassword: false };

    // Live sync: if metadata says decrypted, verify against actual database content
    // This catches cases where the .db file was replaced with an encrypted copy
    if ((entry.ssnState || 'decrypted') === 'decrypted') {
        const detection = detectEncryptedSSNs(dbPath);
        if (detection.encrypted) {
            entry.ssnState = 'encrypted';
            if (detection.salt) {
                entry.ssnSalt = detection.salt;
            }
            saveDatabasesList(list);
        }
    }

    return {
        ssnState: entry.ssnState || 'decrypted',
        hasPassword: !!entry.ssnSalt
    };
});

// --- SSN ENCRYPTION HELPERS ---
const SSN_SALT_LENGTH = 16;
const SSN_IV_LENGTH = 12;
const SSN_KEY_LENGTH = 32;
const SSN_PBKDF2_ITERATIONS = 100000;

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, SSN_PBKDF2_ITERATIONS, SSN_KEY_LENGTH, 'sha256');
}

function encryptSSN(plaintext, key, salt) {
    if (!plaintext || plaintext.trim() === '') return plaintext;
    const iv = crypto.randomBytes(SSN_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    // Format: ENC:<salt>:<iv>:<authTag>:<ciphertext>  (salt embedded for portability)
    return `ENC:${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function decryptSSN(encryptedText, key) {
    if (!encryptedText || !encryptedText.startsWith('ENC:')) return encryptedText;
    const parts = encryptedText.split(':');
    let iv, authTag, ciphertext;
    if (parts.length === 5) {
        // New format: ENC:<salt>:<iv>:<authTag>:<ciphertext>  (salt already used for key derivation)
        iv = Buffer.from(parts[2], 'base64');
        authTag = Buffer.from(parts[3], 'base64');
        ciphertext = parts[4];
    } else if (parts.length === 4) {
        // Legacy format: ENC:<iv>:<authTag>:<ciphertext>
        iv = Buffer.from(parts[1], 'base64');
        authTag = Buffer.from(parts[2], 'base64');
        ciphertext = parts[3];
    } else {
        return encryptedText;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Extract the embedded salt from a 5-part encrypted value, or null for legacy 4-part format
function extractSaltFromEncrypted(encryptedText) {
    if (!encryptedText || !encryptedText.startsWith('ENC:')) return null;
    const parts = encryptedText.split(':');
    if (parts.length === 5) {
        return Buffer.from(parts[1], 'base64');
    }
    return null; // Legacy 4-part format — salt not embedded
}

// Detect if a database has encrypted SSNs and extract salt if available
function detectEncryptedSSNs(dbPath) {
    try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare(
            "SELECT SSN, RSSSN FROM [Reports] WHERE SSN LIKE 'ENC:%' OR RSSSN LIKE 'ENC:%' LIMIT 1"
        ).get();
        db.close();
        console.log(`[detectEncryptedSSNs] path=${dbPath}, found=${!!row}, SSN="${row?.SSN?.substring(0, 30)}", RSSSN="${row?.RSSSN?.substring(0, 30)}"`);

        if (!row) return { encrypted: false, salt: null };

        // Try to extract embedded salt from the encrypted value
        const encValue = row.SSN?.startsWith('ENC:') ? row.SSN : row.RSSSN;
        const salt = extractSaltFromEncrypted(encValue);

        return { encrypted: true, salt: salt ? salt.toString('base64') : null };
    } catch (err) {
        console.error('detectEncryptedSSNs error:', err);
        return { encrypted: false, salt: null };
    }
}

ipcMain.handle('encryptSSNs', async (event, { dbPath, password }) => {
    try {
        const list = getDatabasesList();
        const entry = list.find(d => d.path === dbPath);
        if (!entry) return { success: false, error: 'Database not found in list' };
        if (entry.ssnState === 'encrypted') return { success: false, error: 'SSNs are already encrypted' };

        // Reuse existing salt if password was set before, otherwise generate new
        const salt = entry.ssnSalt
            ? Buffer.from(entry.ssnSalt, 'base64')
            : crypto.randomBytes(SSN_SALT_LENGTH);
        const key = deriveKey(password, salt);

        // If re-encrypting (salt and verify token already exist), validate the password first
        if (entry.ssnSalt && entry.ssnVerifyToken) {
            try {
                const testResult = decryptSSN(entry.ssnVerifyToken, key);
                if (testResult !== 'NAVFIT26_VERIFY') {
                    return { success: false, error: 'Incorrect password' };
                }
            } catch (verifyErr) {
                return { success: false, error: 'Incorrect password' };
            }
        }

        // Create a verification token so we can validate password on decrypt
        // even if all SSN fields are empty
        const verifyToken = encryptSSN('NAVFIT26_VERIFY', key, salt);

        // Open the database and encrypt all SSN and RSSSN values
        const db = new Database(dbPath);
        const rows = db.prepare('SELECT ReportID, SSN, RSSSN FROM [Reports]').all();
        console.log(`[encryptSSNs] Found ${rows.length} rows to encrypt in ${dbPath}`);
        const updateStmt = db.prepare('UPDATE [Reports] SET SSN = ?, RSSSN = ? WHERE ReportID = ?');

        const txn = db.transaction(() => {
            for (const row of rows) {
                const encSSN = encryptSSN(row.SSN, key, salt);
                const encRSSSN = encryptSSN(row.RSSSN, key, salt);
                console.log(`[encryptSSNs] ReportID=${row.ReportID}: SSN "${row.SSN}" -> "${encSSN?.substring(0, 20)}...", RSSSN "${row.RSSSN}" -> "${encRSSSN?.substring(0, 20)}..."`);
                updateStmt.run(encSSN, encRSSSN, row.ReportID);
            }
        });
        txn();
        db.close();

        // Verify the write persisted
        const verifyDb = new Database(dbPath, { readonly: true });
        const verifyRows = verifyDb.prepare('SELECT ReportID, SSN, RSSSN FROM [Reports]').all();
        for (const vr of verifyRows) {
            console.log(`[encryptSSNs] VERIFY ReportID=${vr.ReportID}: SSN="${vr.SSN?.substring(0, 30)}...", RSSSN="${vr.RSSSN?.substring(0, 30)}..."`);
        }
        verifyDb.close();

        // Store salt, verify token, and state (NOT the password or key)
        entry.ssnState = 'encrypted';
        entry.ssnSalt = salt.toString('base64');
        entry.ssnVerifyToken = verifyToken;
        entry.ssnPassword = null; // Never store the password
        saveDatabasesList(list);

        return { success: true, recordsUpdated: rows.length };
    } catch (err) {
        console.error('Encrypt SSNs Error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('decryptSSNs', async (event, { dbPath, password }) => {
    try {
        const list = getDatabasesList();
        const entry = list.find(d => d.path === dbPath);
        if (!entry) return { success: false, error: 'Database not found in list' };
        if (entry.ssnState !== 'encrypted') return { success: false, error: 'SSNs are not encrypted' };

        // Get salt: prefer stored salt, fall back to extracting from encrypted values
        let salt;
        if (entry.ssnSalt) {
            salt = Buffer.from(entry.ssnSalt, 'base64');
        } else {
            // Database was loaded with encrypted SSNs — try extracting embedded salt
            const detection = detectEncryptedSSNs(dbPath);
            if (detection.salt) {
                salt = Buffer.from(detection.salt, 'base64');
                // Persist the extracted salt for future use
                entry.ssnSalt = detection.salt;
                saveDatabasesList(list);
            } else {
                return { success: false, error: 'No encryption salt found — this database may have been encrypted with an older version that did not embed the salt.' };
            }
        }

        // Re-derive the key from the password and stored salt
        const key = deriveKey(password, salt);

        // Pre-validate password using stored verification token before touching the database
        if (entry.ssnVerifyToken) {
            try {
                const testResult = decryptSSN(entry.ssnVerifyToken, key);
                if (testResult !== 'NAVFIT26_VERIFY') {
                    return { success: false, error: 'Incorrect password' };
                }
            } catch (verifyErr) {
                return { success: false, error: 'Incorrect password' };
            }
        } else {
            // Legacy fallback: no verify token stored (encrypted before this feature).
            // Find one encrypted SSN to test the password against.
            const testDb = new Database(dbPath, { readonly: true });
            const testRow = testDb.prepare(
                "SELECT SSN, RSSSN FROM [Reports] WHERE SSN LIKE 'ENC:%' OR RSSSN LIKE 'ENC:%' LIMIT 1"
            ).get();
            testDb.close();
            if (testRow) {
                try {
                    const testValue = testRow.SSN?.startsWith('ENC:') ? testRow.SSN : testRow.RSSSN;
                    decryptSSN(testValue, key);
                } catch (verifyErr) {
                    return { success: false, error: 'Incorrect password' };
                }
            }
            // If no encrypted rows exist, no data to protect — allow state reset
        }

        // Open the database and decrypt all SSN and RSSSN values
        const db = new Database(dbPath);
        const rows = db.prepare('SELECT ReportID, SSN, RSSSN FROM [Reports]').all();
        const updateStmt = db.prepare('UPDATE [Reports] SET SSN = ?, RSSSN = ? WHERE ReportID = ?');

        const txn = db.transaction(() => {
            for (const row of rows) {
                const decSSN = decryptSSN(row.SSN, key);
                const decRSSSN = decryptSSN(row.RSSSN, key);
                updateStmt.run(decSSN, decRSSSN, row.ReportID);
            }
        });
        txn();
        db.close();

        // Update state, keep salt so password persists across cycles
        entry.ssnState = 'decrypted';
        saveDatabasesList(list);

        return { success: true, recordsUpdated: rows.length };
    } catch (err) {
        // If decryption fails (wrong password), the authTag check will throw
        if (err.message.includes('Unsupported state') || err.message.includes('unable to authenticate')) {
            return { success: false, error: 'Incorrect password' };
        }
        console.error('Decrypt SSNs Error:', err);
        return { success: false, error: err.message };
    }
});


ipcMain.handle('uploadDatabase', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Open Database',
        filters: [
            { name: 'All Supported Databases', extensions: ['db', 'sqlite', 'accdb'] },
            { name: 'SQLite Database', extensions: ['db', 'sqlite'] },
            { name: 'Access Database', extensions: ['accdb'] }
        ],
        properties: ['openFile']
    });

    if (result.canceled) return { success: false };

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    try {
        let dbPath = filePath;

        // If the user selected an ACCDB, convert it to SQLite first
        if (ext === '.accdb') {
            const baseName = path.basename(filePath, '.accdb');
            const outputDir = path.dirname(filePath);
            dbPath = path.join(outputDir, `${baseName}.db`);

            await runExportLogic(filePath, dbPath);
        }

        const name = path.basename(dbPath);
        const list = getDatabasesList();

        // Check if the database already has encrypted SSNs
        const detection = detectEncryptedSSNs(dbPath);
        const existing = list.find(d => d.path === dbPath);

        if (existing) {
            // Sync encryption state for existing entries
            if (detection.encrypted && existing.ssnState !== 'encrypted') {
                existing.ssnState = 'encrypted';
                if (detection.salt) {
                    existing.ssnSalt = detection.salt;
                }
                saveDatabasesList(list);
            }
        } else {
            const entry = { name, path: dbPath, ssnState: 'decrypted', ssnPassword: null };
            if (detection.encrypted) {
                entry.ssnState = 'encrypted';
                if (detection.salt) {
                    entry.ssnSalt = detection.salt;
                }
            }
            list.push(entry);
            saveDatabasesList(list);
        }

        return { success: true, name, path: dbPath };
    } catch (err) {
        console.error("Upload Database Error:", err);
        return { success: false, error: `Failed to open database: ${err}` };
    }
});

ipcMain.handle('createDatabase', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Create New Database',
        defaultPath: path.join(app.getPath('desktop'), 'MyEvals.db'),
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (canceled || !filePath) return { success: false };

    try {
        // 1. Copy the pristine template
        fs.copyFileSync(SQLITE_TEMPLATE, filePath);
        
        // 2. ROOT FOLDER FAIL-SAFE: Ensure FolderID 1 exists for NAVFIT98
        const db = new Database(filePath);
        const rootFolder = db.prepare("SELECT * FROM [Folders] WHERE FolderID = 1").get();
        if (!rootFolder) {
            db.prepare(`
                INSERT INTO [Folders] (FolderName, FolderID, Parent, Active)
                VALUES (?, ?, ?, ?)
            `).run('Root', 1, 0, 1);
        }

        // 3. Clear any pre-filled sample data so the database starts empty
        db.prepare("DELETE FROM [Reports]").run();

        db.close();
        
        // 3. Save to tracked list
        const name = path.basename(filePath);
        const list = getDatabasesList();
        list.push({ name, path: filePath, ssnState: 'decrypted', ssnPassword: null });
        saveDatabasesList(list);
        
        return { success: true, name, path: filePath };
    } catch (error) {
        console.error("Create DB Error:", error);
        return { success: false, message: error.message };
    }
});

// 1. Declare mainWindow at the top level
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true, 
            nodeIntegration: false, 
            webSecurity: true 
        }
    });

    // Use our new dynamic menu instead of the old 'createApplicationMenu'
    setDefaultMenu();

    const frontendPath = path.resolve(__dirname, 'frontend_build', 'index.html');

    // Debug check: verify file exists
    if (!fs.existsSync(frontendPath)) {
        console.error(`ERROR: Cannot find frontend build at: ${frontendPath}`);
    }

    mainWindow.loadFile(frontendPath).catch(err => {
        console.error("Failed to load file:", err);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- 6. APP START ---
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- 1. Define the Menu Swapping Functions ---

// The "Standard" menu (Home screen)
function setDefaultMenu() {
    const defaultTemplate = [
        {
            label: 'File',
            submenu: [
                { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
            ]
        },
        { label: 'View', role: 'viewMenu' }
    ];
    const menu = Menu.buildFromTemplate(defaultTemplate);
    Menu.setApplicationMenu(menu);
}

// The "FITREP" menu (Editor screen)
function setFitrepMenu(mainWindow) {
    const fitrepTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow.webContents.send('menu-save-trigger')
                },
                {
                    label: 'Return to Database',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => mainWindow.webContents.send('menu-navigate-home')
                },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
            ]
        },
        { role: 'editMenu' },
        { role: 'viewMenu' }
    ];
    const menu = Menu.buildFromTemplate(fitrepTemplate);
    Menu.setApplicationMenu(menu);
}

// --- 2. The Bridge (Listening for React) ---

ipcMain.on('update-menu-style', (event, style) => {
    // BrowserWindow.fromWebContents is safer for grabbing the specific window
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    
    if (style === 'fitrep') {
        console.log("Switching to FITREP menu");
        setFitrepMenu(mainWindow);
    } else {
        console.log("Switching to Default menu");
        setDefaultMenu();
    }
});

