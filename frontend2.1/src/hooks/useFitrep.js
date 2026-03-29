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
        if (!formData.name || !formData.uic) {
            return triggerNotification("Missing Info", "Name and UIC are required to save.", true);
        }

        // 2. Parse the Full Name into components (e.g. "DOE, JOHN A JR")
        let lastName = "", firstName = "", mi = "", suffix = "";
        if (formData.name) {
            const parts = formData.name.split(',');
            lastName = (parts[0] || '').trim();
            const rest = (parts[1] || '').trim().split(' ');
            firstName = rest[0] || '';
            mi = rest[1] || '';
            suffix = rest[2] || '';
        }

        // 3. Helper to convert Promotion text to Integer
        const promoRecToInt = (val) => {
            const map = { 'NOB': 0, 'Significant Problems': 1, 'Progressing': 2, 'Promotable': 3, 'Must Promote': 4, 'Early Promote': 5 };
            return map[val] ?? null;
        };

        // 4. Map to strict NAVFIT98 SQLite Schema
        const mappedData = {
            ReportType: "FitRep", // NAVFIT98 requires 'FitRep'; Regular/Concurrent/OpsCdr are separate boolean flags
            FullName: formData.name || "",
            FirstName: firstName, 
            MI: mi,              
            LastName: lastName,  
            Suffix: suffix,      
            Rate: formData.grade || "",
            Desig: formData.desig || "",
            SSN: formData.ssn ? formData.ssn.replace(/-/g, '') : "",
            UIC: formData.uic || "",
            ShipStation: formData.station || "",
            PromotionStatus: formData.promo || "",
            BilletSubcat: formData.billetSub || "", // Fixed mismatch
            PhysicalReadiness: formData.physicalRead || "",
            
            // Dates
            DateReported: formData.dateRep || null,
            FromDate: formData.fromPeriod || null,
            ToDate: formData.toPeriod || null,
            DateCounseled: formData.dateCounseled || "",
            Counseler: formData.counselor || "",

            // Booleans (1/0)
            Active: formData.dutyStatus === 'ACT' ? 1 : 0, 
            TAR: formData.dutyStatus === 'FTS' ? 1 : 0, // Fixed mismatch
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

            // Reporting Senior Info
            ReportingSenior: formData.reportSenior || "",
            RSGrade: formData.reportGrade || "",
            RSDesig: formData.reportDesig || "",
            RSTitle: formData.reportTitle || "",
            RSUIC: formData.reportUIC || "",
            RSSSN: formData.reportSSN ? formData.reportSSN.replace(/-/g, '') : "",
            RSAddress: formData.seniorAddress || "",

            // Trait Scores
            PROF: formData.proExpert ? parseInt(formData.proExpert, 10) : 0,
            QUAL: 0, // Not used on W2-O6 forms
            EO: formData.cmeo ? parseInt(formData.cmeo, 10) : 0,
            MIL: formData.bearing ? parseInt(formData.bearing, 10) : 0,
            PA: 0, 
            TEAM: formData.teamwork ? parseInt(formData.teamwork, 10) : 0,
            LEAD: formData.leadership ? parseInt(formData.leadership, 10) : 0,
            MIS: formData.missAccomp ? parseInt(formData.missAccomp, 10) : 0,
            TAC: formData.tactPerform !== "NOB" && formData.tactPerform ? parseInt(formData.tactPerform, 10) : 0,

            // Other
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

            PromotionRecom: promoRecToInt(formData.promotion) // Converted to Integer
        };

        try {
            // 5. Build the new payload structure
            const payload = {
                data: mappedData,
                dbPath: dbPath,
                reportId: reportId
            };

            // 6. Send to the updated backend endpoint
            const result = await window.api.saveFitrep(payload);
            
            if (result.success) {
                triggerNotification("Success", "Report saved to database!", false);
                setIsSaved(true);
                setHasUnsavedChanges(false);
                
                // If this was a new report, capture the ID so subsequent clicks UPDATE instead of duplicating
                if (!reportId && result.reportId) {
                    setCurrentReportId(result.reportId);
                }
                
                // Note: Ensure setSelectedReport doesn't break if you removed it from your hook
                if (typeof setSelectedReport === 'function') {
                    setSelectedReport(mappedData); 
                }
            } else {
                triggerNotification("Error", result.error, true);
            }
        } catch (error) {
            triggerNotification("Error", "Failed to communicate with backend.", true);
        }
    };

    const handlePDFExport = async () => {
        const result = await window.api.exportPDF(selectedReport);
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
        handleACCDBExport, handleSQLiteExport, isSaved, hasUnsavedChanges, getError
    };
}