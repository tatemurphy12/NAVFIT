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
const isWin = process.platform === 'win32';
const javaExecutable = isWin ? 'java.exe' : 'java';

const JAVA_BIN = IS_PROD
    ? path.join(process.resourcesPath, 'bin', 'jre', 'bin', javaExecutable)
    : path.join(BASE_DIR, 'bin', 'jre', 'bin', javaExecutable);

const JAR_PATH = IS_PROD
    ? path.join(process.resourcesPath, 'bin', 'app.jar')
    : path.join(BASE_DIR, 'bin', 'app.jar');

const PDF_TEMPLATE = IS_PROD
    ? path.join(process.resourcesPath, 'templates', 'navfit_fitrep_report_fillable_template.pdf')
    : path.join(PROJECT_ROOT, 'templates', 'navfit_fitrep_report_fillable_template.pdf');

// --- DYNAMIC USER PATHS ---
const DOCUMENTS_DIR = app.getPath('documents');
const USER_DATA_DIR = app.getPath('userData');

const INTERNAL_DATA_DIR = IS_PROD
    ? path.join(USER_DATA_DIR, 'working_data')
    : path.join(BASE_DIR, 'working_data');

const OUTWARD_DIR = IS_PROD
    ? path.join(DOCUMENTS_DIR, 'NavFit_Output')
    : path.join(BASE_DIR, 'output_files');

[OUTWARD_DIR, INTERNAL_DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const DATABASES_LIST_PATH = path.join(app.getPath('userData'), 'databases.json');

function getDatabasesList() {
    if (!fs.existsSync(DATABASES_LIST_PATH)) {
        return [];
    }
    try {
        const list = JSON.parse(fs.readFileSync(DATABASES_LIST_PATH, 'utf-8'));
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

const DEFAULTS = {
    ACCDB_IN: IS_PROD
        ? path.join(process.resourcesPath, 'bin', 'Murphy_example_FITREP.accdb')
        : path.join(BASE_DIR, 'bin', 'Murphy_example_FITREP.accdb'),
        
    SQLITE: path.join(INTERNAL_DATA_DIR, 'migrated_reports.db'),
    
    ACCDB_OUT: path.join(OUTWARD_DIR, 'Generated_FITREP.accdb'),
    PDF_OUT_DIR: OUTWARD_DIR
};

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

    // Inject font size directives so PdfFiller uses them at export time.
    // _defaultFontSize  = all regular text fields (slightly smaller)
    // _commentsFontSize = field f1_41 only
    mapper.pdfMap['_defaultFontSize']  = 8;
    mapper.pdfMap['_commentsFontSize'] = 10;

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
        
        const rootExists = db.prepare("SELECT FolderID FROM [Folders] WHERE FolderID = 1").get();
        if (!rootExists) {
            db.prepare(`INSERT INTO [Folders] (FolderName, FolderID, Parent, Active) VALUES (?, ?, ?, ?)`).run('Root', 1, 0, 1);
        }

        // FIX: Guarantee StatementYes/StatementNo are always present as integers
        // regardless of whether the frontend form sends them or not.
        data.StatementYes = data.StatementYes ? 1 : 0;
        data.StatementNo  = data.StatementNo  ? 1 : 0;

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
        if (!fs.existsSync(dbPath)) return { error: "File not found" };
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
        const entry = list.find(db => db.path === dbPath);

        if (!entry || !entry.path) {
            list = list.filter(db => db.path !== dbPath);
            saveDatabasesList(list);
            return { success: true };
        }

        if (entry.ssnState === 'encrypted') {
            return { success: false, message: 'Cannot remove a database with encrypted SSNs. Please decrypt SSNs first.' };
        }

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

ipcMain.handle('getRaterGroupSummary', async (e, dbPath) => {
    try {
        if (!dbPath || !fs.existsSync(dbPath)) {
            return { error: "Database not found" };
        }
        const db = new Database(dbPath, { readonly: true });

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

        const memberAverages = [];
        const promoCounts = { sigProb: 0, prog: 0, promotable: 0, mustPromote: 0, earlyPromote: 0 };

        for (const row of rows) {
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

ipcMain.handle('export-accdb', async (e, dbPath) => {
    let tempDbPath = null;
    try {
        if (!dbPath || !fs.existsSync(dbPath)) {
            throw new Error("No database found. Please open or create a database first.");
        }

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

        const sourceDb = new Database(dbPath, { readonly: true });
        const reports = sourceDb.prepare("SELECT * FROM [Reports]").all();
        sourceDb.close();

        if (!reports || reports.length === 0) {
            throw new Error("No reports found in database. Save a report before exporting.");
        }

        tempDbPath = path.join(INTERNAL_DATA_DIR, `accdb_staging_${Date.now()}.db`);
        fs.copyFileSync(SQLITE_TEMPLATE, tempDbPath);

        const tempDb = new Database(tempDbPath);
        tempDb.exec("DELETE FROM [Reports]; DELETE FROM [Folders]; DELETE FROM [Summary];");

        tempDb.prepare(`
            INSERT INTO [Folders] (FolderName, FolderID, Parent, Active)
            VALUES (?, ?, ?, ?)
        `).run('Root', 1, 0, 1);

        const reportStmt = tempDb.prepare(`
            INSERT INTO [Reports] (
                Parent, ReportType, FullName, FirstName, MI, LastName, Suffix,
                Rate, Desig, SSN, Active, TAR, Inactive, ATADSW, UIC, ShipStation,
                PromotionStatus, DateReported, Periodic, DetInd, Frocking, Special,
                FromDate, ToDate, NOB, Regular, Concurrent, OpsCdr,
                ReportingSenior, RSGrade, RSDesig, RSTitle, RSUIC, RSSSN, RSAddress,
                Achievements, PrimaryDuty, Duties, DateCounseled, Counseler,
                PROF, QUAL, EO, MIL, PA, TEAM, LEAD, MIS, TAC,
                RecommendA, RecommendB, Comments, PromotionRecom
            ) VALUES (
                'a 1',
                @ReportType, @FullName, @FirstName, @MI, @LastName, @Suffix,
                @Rate, @Desig, @SSN, @Active, @TAR, @Inactive, @ATADSW, @UIC, @ShipStation,
                @PromotionStatus, @DateReported, @Periodic, @DetInd, @Frocking, @Special,
                @FromDate, @ToDate, @NOB, @Regular, @Concurrent, @OpsCdr,
                @ReportingSenior, @RSGrade, @RSDesig, @RSTitle, @RSUIC, @RSSSN, @RSAddress,
                @Achievements, @PrimaryDuty, @Duties, @DateCounseled, @Counseler,
                @PROF, @QUAL, @EO, @MIL, @PA, @TEAM, @LEAD, @MIS, @TAC,
                @RecommendA, @RecommendB, @Comments, @PromotionRecom
            )
        `);

        for (const report of reports) {
            report.ReportType = 'FitRep';

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

        await runImportLogic(tempDbPath, filePath);

        console.log(`Successfully exported ACCDB to: ${filePath}`);
        return { success: true, path: filePath };

    } catch (err) {
        console.error("Export ACCDB Error:", err);
        return { success: false, error: err.message };
    } finally {
        if (tempDbPath && fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch (_) {}
        }
    }
});

function generateDynamicName(dbPath, extension) {
    try {
        const db = new Database(dbPath, { readonly: true });
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
        return `Generated_FITREP.${extension}`;
    }
}

function isDbEncrypted(dbPath) {
    const list = getDatabasesList();
    const entry = list.find(d => d.path === dbPath);
    return entry && entry.ssnState === 'encrypted';
}

// Generate PDF
ipcMain.handle('generate-report', async (e, reportData) => {
    try {
        if (reportData && reportData.dbPath && isDbEncrypted(reportData.dbPath)) {
            return { success: false, error: 'SSNs are currently encrypted. Please decrypt SSNs before exporting to PDF.' };
        }

        let dataModel = reportData ? new FitRepData(reportData) : FitRepData.mock();
        const safeName = (dataModel.FullName || "Draft_Report").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const defaultPdfName = `Report_${safeName}.pdf`;

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save PDF Report',
            defaultPath: path.join(app.getPath('desktop'), defaultPdfName), 
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) return { success: false, error: "PDF Export cancelled." };

        const outPath = await runReportLogic(reportData, filePath);
        return { success: true, path: outPath };
    } catch (err) { 
        console.error("PDF Generation Error:", err);
        return { success: false, error: err.message }; 
    }
});

// --- HOMEPAGE FILE MANAGEMENT HANDLERS ---

ipcMain.handle('getDatabases', async () => {
    return getDatabasesList();
});

ipcMain.handle('getDbSsnState', async (event, dbPath) => {
    const list = getDatabasesList();
    const entry = list.find(d => d.path === dbPath);
    if (!entry) return { ssnState: 'decrypted', hasPassword: false };
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

function encryptSSN(plaintext, key) {
    if (!plaintext || plaintext.trim() === '') return plaintext;
    const iv = crypto.randomBytes(SSN_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `ENC:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function decryptSSN(encryptedText, key) {
    if (!encryptedText || !encryptedText.startsWith('ENC:')) return encryptedText;
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const ciphertext = parts[3];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

ipcMain.handle('encryptSSNs', async (event, { dbPath, password }) => {
    try {
        const list = getDatabasesList();
        const entry = list.find(d => d.path === dbPath);
        if (!entry) return { success: false, error: 'Database not found in list' };
        if (entry.ssnState === 'encrypted') return { success: false, error: 'SSNs are already encrypted' };

        const checkDb = new Database(dbPath, { readonly: true });
        const reportCount = checkDb.prepare('SELECT COUNT(*) as count FROM [Reports]').get();
        checkDb.close();
        if (!reportCount || reportCount.count === 0) {
            return { success: false, error: 'Cannot encrypt SSNs until at least one report has been created.' };
        }

        const salt = entry.ssnSalt
            ? Buffer.from(entry.ssnSalt, 'base64')
            : crypto.randomBytes(SSN_SALT_LENGTH);
        const key = deriveKey(password, salt);

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

        const verifyToken = encryptSSN('NAVFIT26_VERIFY', key);

        const db = new Database(dbPath);
        const rows = db.prepare('SELECT rowid, SSN, RSSSN FROM [Reports]').all();
        const updateStmt = db.prepare('UPDATE [Reports] SET SSN = ?, RSSSN = ? WHERE rowid = ?');

        const txn = db.transaction(() => {
            for (const row of rows) {
                const encSSN = encryptSSN(row.SSN, key);
                const encRSSSN = encryptSSN(row.RSSSN, key);
                updateStmt.run(encSSN, encRSSSN, row.rowid);
            }
        });
        txn();
        db.close();

        entry.ssnState = 'encrypted';
        entry.ssnSalt = salt.toString('base64');
        entry.ssnVerifyToken = verifyToken;
        entry.ssnPassword = null;
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
        if (!entry.ssnSalt) return { success: false, error: 'No encryption salt found — cannot decrypt' };

        const salt = Buffer.from(entry.ssnSalt, 'base64');
        const key = deriveKey(password, salt);

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
        }

        const db = new Database(dbPath);
        const rows = db.prepare('SELECT rowid, SSN, RSSSN FROM [Reports]').all();
        const updateStmt = db.prepare('UPDATE [Reports] SET SSN = ?, RSSSN = ? WHERE rowid = ?');

        const txn = db.transaction(() => {
            for (const row of rows) {
                const decSSN = decryptSSN(row.SSN, key);
                const decRSSSN = decryptSSN(row.RSSSN, key);
                updateStmt.run(decSSN, decRSSSN, row.rowid);
            }
        });
        txn();
        db.close();

        entry.ssnState = 'decrypted';
        saveDatabasesList(list);

        return { success: true, recordsUpdated: rows.length };
    } catch (err) {
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

        if (ext === '.accdb') {
            const baseName = path.basename(filePath, '.accdb');
            const outputDir = path.dirname(filePath);
            dbPath = path.join(outputDir, `${baseName}.db`);
            await runExportLogic(filePath, dbPath);
        }

        const name = path.basename(dbPath);
        const list = getDatabasesList();

        if (!list.find(d => d.path === dbPath)) {
            list.push({ name, path: dbPath, ssnState: 'decrypted', ssnPassword: null });
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
        fs.copyFileSync(SQLITE_TEMPLATE, filePath);
        
        const db = new Database(filePath);
        const rootFolder = db.prepare("SELECT * FROM [Folders] WHERE FolderID = 1").get();
        if (!rootFolder) {
            db.prepare(`
                INSERT INTO [Folders] (FolderName, FolderID, Parent, Active)
                VALUES (?, ?, ?, ?)
            `).run('Root', 1, 0, 1);
        }
        db.prepare("DELETE FROM [Reports]").run();
        db.close();
        
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

// --- 5. APP LIFECYCLE (GUI Setup) ---
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true, 
            nodeIntegration: false, 
            webSecurity: true 
        }
    });

    createApplicationMenu(mainWindow);

    const frontendPath = path.resolve(__dirname, 'frontend_build', 'index.html');

    if (!fs.existsSync(frontendPath)) {
        console.error(`ERROR: Cannot find frontend build at: ${frontendPath}`);
        console.log("Did you run 'npm run build' in your React folder and move it here?");
    }

    mainWindow.loadFile(frontendPath).catch(err => {
        console.error("Failed to load file:", err);
    });
}

function createApplicationMenu(mainWindow) {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Return to Database',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => {
                        mainWindow.webContents.send('menu-navigate-home');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => { app.quit(); }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});