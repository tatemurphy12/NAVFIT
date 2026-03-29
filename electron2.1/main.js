const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
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

// Detect if running on Windows
const isWin = process.platform === 'win32';
const javaExecutable = isWin ? 'java.exe' : 'java';

// Java Paths
const JAVA_BIN = IS_PROD
    ? path.join(process.resourcesPath, 'bin', 'jre', 'bin', javaExecutable)
    : path.join(BASE_DIR, 'bin', 'jre', 'bin', javaExecutable);

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
        return JSON.parse(fs.readFileSync(DATABASES_LIST_PATH, 'utf-8'));
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

        if (!reportId) {
            // -- ADD NEW REPORT (INSERT) --
            const reportStmt = db.prepare(`
                INSERT INTO [Reports] (
                    Parent, ReportType, FullName, FirstName, MI, LastName, Suffix,
                    Rate, Desig, SSN, Active, TAR, Inactive, ATADSW, UIC, ShipStation, 
                    PromotionStatus, DateReported, Periodic, DetInd, Frocking, Special, 
                    FromDate, ToDate, NOB, Regular, Concurrent, OpsCdr, 
                    ReportingSenior, RSGrade, RSDesig, RSTitle, RSUIC, RSSSN, RSAddress,
                    Achievements, PrimaryDuty, Duties, DateCounseled, 
                    PROF, QUAL, EO, MIL, PA, TEAM, LEAD, MIS, TAC,
                    RecommendA, RecommendB, Comments, PromotionRecom
                ) VALUES (
                    'a 1', @ReportType, @FullName, @FirstName, @MI, @LastName, @Suffix,
                    @Rate, @Desig, @SSN, @Active, @TAR, @Inactive, @ATADSW, @UIC, @ShipStation,
                    @PromotionStatus, @DateReported, @Periodic, @DetInd, @Frocking, @Special,
                    @FromDate, @ToDate, @NOB, @Regular, @Concurrent, @OpsCdr,
                    @ReportingSenior, @RSGrade, @RSDesig, @RSTitle, @RSUIC, @RSSSN, @RSAddress,
                    @Achievements, @PrimaryDuty, @Duties, @DateCounseled,
                    @PROF, @QUAL, @EO, @MIL, @PA, @TEAM, @LEAD, @MIS, @TAC,
                    @RecommendA, @RecommendB, @Comments, @PromotionRecom
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
                    Achievements=@Achievements, PrimaryDuty=@PrimaryDuty, Duties=@Duties, DateCounseled=@DateCounseled, 
                    PROF=@PROF, QUAL=@QUAL, EO=@EO, MIL=@MIL, PA=@PA, TEAM=@TEAM, LEAD=@LEAD, MIS=@MIS, TAC=@TAC,
                    RecommendA=@RecommendA, RecommendB=@RecommendB, Comments=@Comments, PromotionRecom=@PromotionRecom
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

// 2. OUTWARD EXPORT: Copies the internal database to the user's Documents folder
// 2. OUTWARD EXPORT: Copies the internal database to the user's chosen folder
ipcMain.handle('export-sqlite', async (e) => {
    try {
        if (!fs.existsSync(DEFAULTS.SQLITE)) {
            throw new Error("No internal database found. Please save the FitRep first.");
        }

        const db = new Database(DEFAULTS.SQLITE, { readonly: true });
        const report = db.prepare("SELECT FullName, UIC FROM [Reports] LIMIT 1").get();
        db.close();

        let outputFileName = 'Generated_FITREP.sqlite'; 
        if (report) {
            const namePart = report.FullName || "Draft";
            const uicPart = report.UIC || "NoUIC";
            const safeName = `${namePart}_${uicPart}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            outputFileName = `FITREP_${safeName}.sqlite`;
        }

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Export SQLite Database',
            defaultPath: path.join(app.getPath('desktop'), outputFileName),
            filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
        });

        if (canceled || !filePath) return { success: false, error: "Export cancelled." };

        // We use filePath here exclusively now!
        fs.copyFileSync(DEFAULTS.SQLITE, filePath);
        console.log(`Successfully exported SQLite to: ${filePath}`);

        return { success: true, path: filePath };
    } catch (err) { 
        console.error("Export SQLite Error:", err);
        return { success: false, error: err.message }; 
    }
});

// 2. Export ACCDB (Java trigger)
// Creates a clean temporary SQLite copy with NAVFIT98-compatible structure,
// hands it to the Java converter, then cleans up the temp file.
ipcMain.handle('export-accdb', async (e, dbPath) => {
    let tempDbPath = null;
    try {
        if (!dbPath || !fs.existsSync(dbPath)) {
            throw new Error("No database found. Please open or create a database first.");
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
                Achievements, PrimaryDuty, Duties, DateCounseled,
                PROF, QUAL, EO, MIL, PA, TEAM, LEAD, MIS, TAC,
                RecommendA, RecommendB, Comments, PromotionRecom
            ) VALUES (
                'a 1',
                @ReportType, @FullName, @FirstName, @MI, @LastName, @Suffix,
                @Rate, @Desig, @SSN, 1, @TAR, @Inactive, @ATADSW, @UIC, @ShipStation,
                @PromotionStatus, @DateReported, @Periodic, @DetInd, @Frocking, @Special,
                @FromDate, @ToDate, @NOB, @Regular, @Concurrent, @OpsCdr,
                @ReportingSenior, @RSGrade, @RSDesig, @RSTitle, @RSUIC, @RSSSN, @RSAddress,
                @Achievements, @PrimaryDuty, @Duties, @DateCounseled,
                @PROF, @QUAL, @EO, @MIL, @PA, @TEAM, @LEAD, @MIS, @TAC,
                @RecommendA, @RecommendB, @Comments, @PromotionRecom
            )
        `);

        for (const report of reports) {
            // Normalize ReportType for legacy reports saved before this fix
            report.ReportType = 'FitRep';
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

// THE HELPER FUNCTION
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

// 3. Generate PDF
ipcMain.handle('generate-report', async (e, reportData) => {
    try {
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


ipcMain.handle('uploadDatabase', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Select SQLite Database',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
    });

    if (!result.canceled) {
        const filePath = result.filePaths[0];
        const name = path.basename(filePath);
        const list = getDatabasesList();
        
        // Prevent duplicate entries in the tracking list
        if (!list.find(d => d.path === filePath)) {
            list.push({ name, path: filePath });
            saveDatabasesList(list);
        }
        return { success: true, name, path: filePath };
    }
    return { success: false };
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
        list.push({ name, path: filePath });
        saveDatabasesList(list);
        
        return { success: true, name, path: filePath };
    } catch (error) {
        console.error("Create DB Error:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('exportDb', async (event, sourceDbPath) => {
    if (!sourceDbPath) return { success: false, message: 'No source database path provided.' };

    const { filePath } = await dialog.showSaveDialog({
        title: 'Export Database',
        defaultPath: path.join(app.getPath('desktop'), path.basename(sourceDbPath)),
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (filePath) {
        try {
            fs.copyFileSync(sourceDbPath, filePath);
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    return { success: false, message: 'Export cancelled' };
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

    // 1. Resolve the path absolutely
    const frontendPath = path.resolve(__dirname, 'frontend_build', 'index.html');

    // 2. Debug check: Log to terminal so you can see where it's looking
    if (!fs.existsSync(frontendPath)) {
        console.error(`ERROR: Cannot find frontend build at: ${frontendPath}`);
        console.log("Did you run 'npm run build' in your React folder and move it here?");
    }

    mainWindow.loadFile(frontendPath).catch(err => {
        console.error("Failed to load file:", err);
    });
    mainWindow.webContents.openDevTools();
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
