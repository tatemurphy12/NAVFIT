import { useState, useEffect } from 'react';
import validators from '../utils/formatters'; // Import the toolbox

export default function useFitrep(dbPath) {
    const initialFormState = {
        name: '', grade: '', desig: '', ssn: '', dutyStatus: '',
        uic: '', station: '', promo: '', dateRep: '', occasion: '',
        fromPeriod: '', toPeriod: '', notObserved: '', reportType: '',
        physicalRead: '', billetSub: '', reportSenior: '', reportGrade: '',
        reportDesig: '', reportTitle: '', reportUIC: '', reportSSN: '',
        cmdEmployAch: '', primaryDuty: '', duties: '', dateCounseled: '', counselor: '',
        proExpert: '', cmeo: '', bearing: '', teamwork: '',
        missAccomp: '', leadership: '', tactPerform: '',
        milestoneOne: '', milestoneTwo: '', comments: '',
        promotion: '', sumPromo: '', seniorAddress: '', statement: '',
    };
    
    const [formData, setFormData] = useState(initialFormState);
    const [message, setMessage] = useState('Ready');
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', text: '', isError: false });
    const [selectedReport, setSelectedReport] = useState(null);

    // GATEKEEPER STATES
    const [isSaved, setIsSaved] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // SSN ENCRYPTION STATE
    const [ssnEncrypted, setSsnEncrypted] = useState(false);
    // When an export is blocked by encryption, store which export to resume after decrypt
    const [pendingExport, setPendingExport] = useState(null); // 'pdf' | 'accdb' | null
    const [showDecryptModal, setShowDecryptModal] = useState(false);

    // Fetch SSN encryption state on mount
    useEffect(() => {
        if (!dbPath) return;
        window.api.getDbSsnState(dbPath).then(result => {
            setSsnEncrypted(result.ssnState === 'encrypted');
        });
    }, [dbPath]);

    // RATER GROUP SUMMARY (computed from all reports in the database)
    const [raterGroupSummary, setRaterGroupSummary] = useState({
        summaryGroupAverage: 'NAN',
        promoCounts: { sigProb: 0, prog: 0, promotable: 0, mustPromote: 0, earlyPromote: 0 }
    });

    // Fetch rater group summary from all reports in the database
    const fetchRaterGroupSummary = async () => {
        if (!dbPath || !window.api?.getRaterGroupSummary) return;
        try {
            const result = await window.api.getRaterGroupSummary(dbPath);
            if (result && !result.error) {
                setRaterGroupSummary(result);
                // Auto-fill the summary promo counts into the form
                setFormData(prev => ({
                    ...prev,
                    sumPromo: {
                        sigProb: String(result.promoCounts.sigProb || 0),
                        prog: String(result.promoCounts.prog || 0),
                        promotable: String(result.promoCounts.promotable || 0),
                        mustPromote: String(result.promoCounts.mustPromote || 0),
                        earlyPromote: String(result.promoCounts.earlyPromote || 0),
                    }
                }));
            }
        } catch (err) {
            console.warn('[useFitrep] Failed to fetch rater group summary:', err);
        }
    };

    // Fetch the rater group summary when the database path is available
    useEffect(() => {
        fetchRaterGroupSummary();
    }, [dbPath]);

    const triggerNotification = (title, text, isError = false) => {
        setModalContent({ title, text, isError });
        setShowModal(true);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true); // Flag that an edit occurred
    };

    const calculateTraitAverage = () => {
        // 1. Pull the raw scores
        const rawScores = [
            formData.proExpert,   // Professional Expertise (PROF)
            formData.professionalism, // Professionalism (QUAL)
            formData.cmeo,        // Equal Opportunity (EO)
            formData.bearing,     // Military Bearing (MIL)
            formData.teamwork,    // Teamwork (TEAM)
            formData.leadership,  // Leadership (LEAD)
            formData.missAccomp,  // Mission Accomplishment (MIS)
        ];
    
        // 2. Add Tactical Performance (TAC) only if it exists and is not NOB
        if (formData.tactPerform && formData.tactPerform !== "NOB") {
            rawScores.push(formData.tactPerform);
        }
    
        // 3. Convert to numbers and filter out zeros or non-numeric entries (NOBs)
        const validScores = rawScores
            .map(val => parseFloat(val))
            .filter(num => !isNaN(num) && num > 0);
    
        // 4. Return the average fixed to 2 decimal places
        if (validScores.length === 0) return "0.00";
        
        const sum = validScores.reduce((a, b) => a + b, 0);
        return (sum / validScores.length).toFixed(2);
    };

    const handleSaveFitrep = async (reportId, setCurrentReportId) => {
        // 1. Basic Validation
        if (!dbPath) {
            return triggerNotification("Error", "No database selected! Please open a database from the home screen.", true);
        }
    
        // 2. Parse the Full Name into components...
        let lastName = "", firstName = "", mi = "", suffix = "";
        if (formData.name) {
            const parts = formData.name.split(',');
            lastName = (parts[0] || '').trim();
            const rest = (parts[1] || '').trim().split(' ');
            firstName = rest[0] || '';
            mi = rest[1] || '';
            suffix = rest[2] || '';
        }
    
        // 3. Helper to convert Promotion text to Integer...
        const promoRecToInt = (val) => {
            const map = { 'NOB': 0, 'SIGNIFICANT PROBLEMS': 1, 'PROGRESSING': 2, 'PROMOTABLE': 3, 'MUST PROMOTE': 4, 'EARLY PROMOTE': 5 };
            return map[val] ?? null;
        };
    
        // 4. Map to strict NAVFIT98 SQLite Schema...
        const mappedData = {
            ReportType: "FitRep",
            FullName: formData.name || "",
            FirstName: firstName, 
            MI: mi,              
            LastName: lastName,  
            Suffix: suffix,      
            Rate: formData.grade || "",
            Desig: formData.desig || "",
            SSN: formData.ssn || "",
            UIC: formData.uic || "",
            ShipStation: formData.station || "",
            PromotionStatus: formData.promo || "",
            BilletSubcat: formData.billetSub || "",
            PhysicalReadiness: formData.physicalRead || "",
            DateReported: formData.dateRep || null,
            FromDate: formData.fromPeriod || null,
            ToDate: formData.toPeriod || null,
            DateCounseled: formData.dateCounseled || "",
            Counseler: formData.counselor || "",
            Active: formData.dutyStatus === 'ACT' ? 1 : 0, 
            TAR: formData.dutyStatus === 'FTS' ? 1 : 0,
            Inactive: formData.dutyStatus === 'INACT' ? 1 : 0,
            ATADSW: formData.dutyStatus === 'AT/ADSW/' ? 1 : 0,
            Periodic: formData.occasion === 'Periodic' ? 1 : 0,
            DetInd: formData.occasion === 'Detachment of Individual' ? 1 : 0,
            Frocking: formData.occasion === 'Detachment of Reporting Senior' ? 1 : 0, 
            Special: formData.occasion === 'Special' ? 1 : 0,
            NOB: formData.notObserved === 'Not Observed Report' ? 1 : 0,
            Regular: formData.reportType === 'Regular' ? 1 : 0, 
            Concurrent: formData.reportType === 'Concurrent' ? 1 : 0,
            OpsCdr: formData.reportType === 'Ops Cdr' ? 1 : 0,
            ReportingSenior: formData.reportSenior || "",
            RSGrade: formData.reportGrade || "",
            RSDesig: formData.reportDesig || "",
            RSTitle: formData.reportTitle || "",
            RSUIC: formData.reportUIC || "",
            RSSSN: formData.reportSSN ||  "",
            RSAddress: formData.seniorAddress || "",
            PROF: formData.proExpert && formData.proExpert !== "NOB" ? parseInt(formData.proExpert, 10) : 0,
            QUAL: 0,
            EO: formData.cmeo && formData.cmeo !== "NOB" ? parseInt(formData.cmeo, 10) : 0,
            MIL: formData.bearing && formData.bearing !== "NOB" ? parseInt(formData.bearing, 10) : 0,
            PA: 0,
            TEAM: formData.teamwork && formData.teamwork !== "NOB" ? parseInt(formData.teamwork, 10) : 0,
            LEAD: formData.leadership && formData.leadership !== "NOB" ? parseInt(formData.leadership, 10) : 0,
            MIS: formData.missAccomp && formData.missAccomp !== "NOB" ? parseInt(formData.missAccomp, 10) : 0,
            TAC: formData.tactPerform && formData.tactPerform !== "NOB" ? parseInt(formData.tactPerform, 10) : 0,
            Achievements: formData.cmdEmployAch || "",
            PrimaryDuty: formData.primaryDuty || "",
            Duties: formData.duties || "",
            Comments: formData.comments || "",
            RecommendA: formData.milestoneOne || "",
            RecommendB: formData.milestoneTwo || "",
            SummarySP: formData.sumPromo?.sigProb || "",
            SummaryProg: formData.sumPromo?.prog || "",
            SummaryProm: formData.sumPromo?.promotable || "",
            SummaryMP: formData.sumPromo?.mustPromote || "",
            SummaryEP: formData.sumPromo?.earlyPromote || "",
            PromotionRecom: promoRecToInt(formData.promotion)
        };
    
        try {
            const payload = {
                data: mappedData,
                dbPath: dbPath,
                reportId: reportId
            };
    
            const result = await window.api.saveFitrep(payload);
            
            if (result.success) {
                triggerNotification("Success", "Report saved to database!", false);
                setIsSaved(true);
                setHasUnsavedChanges(false);
                
                if (!reportId && result.reportId) {
                    setCurrentReportId(result.reportId);
                }
                
                if (typeof setSelectedReport === 'function') {
                    setSelectedReport(mappedData);
                }
    
                fetchRaterGroupSummary();
                
                // --- CRITICAL ADDITION ---
                return result; 
            } else {
                triggerNotification("Error", result.error, true);
                // --- CRITICAL ADDITION ---
                return result;
            }
        } catch (error) {
            triggerNotification("Error", "Failed to communicate with backend.", true);
            // --- CRITICAL ADDITION ---
            return { success: false, error: error.message };
        }
    };

    const handlePDFExport = async () => {
        // Build export data directly from current form state so the PDF
        // always reflects what is on screen (not a stale selectedReport).
        const exportData = {
            dbPath: dbPath || "",
            FullName: formData.name || "",
            Rate: formData.grade || "",
            Desig: formData.desig || "",
            SSN: formData.ssn ? formData.ssn.replace(/-/g, '') : "",
            Active: formData.dutyStatus === 'ACT' ? 1 : 0,
            TAR: formData.dutyStatus === 'FTS' ? 1 : 0,
            Inactive: formData.dutyStatus === 'INACT' ? 1 : 0,
            ATADSW: formData.dutyStatus === 'AT/ADSW/' ? 1 : 0,
            UIC: formData.uic || "",
            ShipStation: formData.station || "",
            PromotionStatus: formData.promo || "",
            DateReported: formData.dateRep || "",
            Periodic: formData.occasion === 'Periodic' ? 1 : 0,
            DetInd: formData.occasion === 'Detachment of Individual' ? 1 : 0,
            DetRS: formData.occasion === 'Detachment of Reporting Senior' ? 1 : 0,
            Special: formData.occasion === 'Special' ? 1 : 0,
            FromDate: formData.fromPeriod || "",
            ToDate: formData.toPeriod || "",
            NOB: formData.notObserved === 'Not Observed Report' ? 1 : 0,
            Regular: formData.reportType === 'Regular' ? 1 : 0,
            Concurrent: formData.reportType === 'Concurrent' ? 1 : 0,
            OpsCdr: formData.reportType === 'Ops Cdr' ? 1 : 0,
            PhysicalReadiness: formData.physicalRead || "",
            BilletSubcat: formData.billetSub || "",
            ReportingSenior: formData.reportSenior || "",
            RSGrade: formData.reportGrade || "",
            RSDesig: formData.reportDesig || "",
            RSTitle: formData.reportTitle || "",
            RSUIC: formData.reportUIC || "",
            RSSSN: formData.reportSSN ? formData.reportSSN.replace(/-/g, '') : "",
            RSAddress: formData.seniorAddress || "",
            Achievements: formData.cmdEmployAch || "",
            PrimaryDuty: formData.primaryDuty || "",
            Duties: formData.duties || "",
            DateCounseled: formData.dateCounseled || "",
            Counseler: formData.counselor || "",
            PROF: formData.proExpert || "",
            EO: formData.cmeo || "",
            MIL: formData.bearing || "",
            TEAM: formData.teamwork || "",
            MIS: formData.missAccomp || "",
            LEAD: formData.leadership || "",
            TAC: formData.tactPerform || "",
            RecommendA: formData.milestoneOne || "",
            RecommendB: formData.milestoneTwo || "",
            Comments: formData.comments || "",
            PromotionRecom: (() => {
                const map = { 'NOB': 1, 'SIGNIFICANT PROBLEMS': 2, 'PROGRESSING': 3, 'PROMOTABLE': 4, 'MUST PROMOTE': 5, 'EARLY PROMOTE': 6 };
                return map[formData.promotion] || "";
            })(),
            SummarySP: formData.sumPromo?.sigProb || "",
            SummaryProg: formData.sumPromo?.prog || "",
            SummaryProm: formData.sumPromo?.promotable || "",
            SummaryMP: formData.sumPromo?.mustPromote || "",
            SummaryEP: formData.sumPromo?.earlyPromote || "",
            RSCA: raterGroupSummary?.summaryGroupAverage || "",
        };
        const result = await window.api.exportPDF(exportData);
        if (result.success) {
            triggerNotification("Success", `PDF exported successfully!`, false);
        } else {
            // Silently close if the user just hit 'Cancel' in the save dialog
            if (result.error && result.error.includes("cancelled")) {
                setShowModal(false);
            } else {
                // Show the ACTUAL backend error
                triggerNotification("Error", result.error || "Failed to generate PDF.", true);
            }
        }
    };

    const handleACCDBExport = async () => {
    if (!dbPath) {
        return triggerNotification("Error", "No database selected.", true);
    }

    // Block if SSNs are encrypted — prompt user to decrypt first
    if (ssnEncrypted) {
        setPendingExport('accdb');
        setShowDecryptModal(true);
        return;
    }
    
    // Optional: Auto-save before exporting to ensure the ACCDB has the latest data
    if (hasUnsavedChanges) {
        triggerNotification("Info", "Saving changes before export...", false);
        // Assuming currentReportId is accessible, or you might need to prompt the user to save first.
    }

    try {
        // Pass the dbPath to the backend handler
        const response = await window.api.exportACCDB(dbPath);
        if (response.success) {
            triggerNotification('Success', `ACCDB Exported successfully to:\n${response.path}`, false);
        } else if (response.error !== "ACCDB Export cancelled.") {
            triggerNotification('Error', `Failed to export ACCDB: ${response.error}`, true);
        }
    } catch (error) {
        triggerNotification('Error', 'An unexpected error occurred during ACCDB export.', true);
    }
  };

  const handleSQLiteExport = async () => {
    if (!dbPath) {
        return triggerNotification("Error", "No database selected.", true);
    }

    try {
        // We use the new exportDb handler we created in Step 1!
        const response = await window.api.exportDb(dbPath);
        if (response.success) {
            triggerNotification('Success', `SQLite copy saved successfully to:\n${response.path}`, false);
        } else if (response.message !== "Export cancelled") {
            triggerNotification('Error', `Failed to export SQLite: ${response.message}`, true);
        }
    } catch (error) {
        triggerNotification('Error', 'An unexpected error occurred during SQLite export.', true);
    }
  };

    // Called from FitrepForm when user enters password in the decrypt modal
    const handleDecryptForExport = async (password, reportId) => {
        const result = await window.api.decryptSSNs({ dbPath, password });
        if (result.success) {
            setSsnEncrypted(false);
            setShowDecryptModal(false);
            // Re-load the current report to get decrypted SSN values
            if (dbPath && reportId) {
                const reportData = await window.api.loadFitrep({ dbPath, reportId });
                if (reportData && !reportData.error) {
                    setFormData(prev => ({
                        ...prev,
                        ssn: reportData.SSN || '',
                        reportSSN: reportData.RSSSN || '',
                    }));
                }
            }
            // Resume the pending export
            const exportType = pendingExport;
            setPendingExport(null);
            if (exportType === 'pdf') {
                handlePDFExport();
            } else if (exportType === 'accdb') {
                // Call export API directly — handleACCDBExport would re-check
                // ssnEncrypted via stale closure and re-open the modal
                try {
                    const response = await window.api.exportACCDB(dbPath);
                    if (response.success) {
                        triggerNotification('Success', `ACCDB Exported successfully to:\n${response.path}`, false);
                    } else if (response.error !== "ACCDB Export cancelled.") {
                        triggerNotification('Error', `Failed to export ACCDB: ${response.error}`, true);
                    }
                } catch (error) {
                    triggerNotification('Error', 'An unexpected error occurred during ACCDB export.', true);
                }
            }
            return { success: true };
        }
        return { success: false, error: result.error || 'Decryption failed.' };
    };

    const getError = (field) => {
        if (validators[field]) {
          const result = validators[field](formData[field], formData);
          return result || { isError: false, note: "" };
        }
        return { isError: false, note: "" };
      };

    return {
        formData, setFormData, message, setMessage, showModal, setShowModal, modalContent,
        handleChange, handlePDFExport, calculateTraitAverage, handleSaveFitrep,
        handleACCDBExport, handleSQLiteExport, isSaved, hasUnsavedChanges, getError,
        raterGroupSummary, ssnEncrypted, showDecryptModal, setShowDecryptModal,
        handleDecryptForExport
    };
}