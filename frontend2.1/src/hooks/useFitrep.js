import { useState, useEffect } from 'react';
import validators from '../utils/formatters'; // Import the toolbox

export default function useFitrep(activeSqliteDb) {
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

    const handleSaveFitrep = async () => {
        if (!formData.name || !formData.uic) {
            return triggerNotification("Missing Info", "Name and UIC are required to save.", true);
        }

        // Map to strict NAVFIT98 SQLite Schema
        // --- Inside handleSaveFitrep in useFitrep.js ---
        const mappedData = {
            ReportType: formData.reportType || "FitRep",
            FullName: formData.name || "",
            FirstName: formData.firstName || "", // Added to match schema
            MI: formData.mi || "",               // Added to match schema
            LastName: formData.lastName || "",   // Added to match schema
            Suffix: formData.suffix || "",       // Added to match schema
            Rate: formData.grade || "",
            Desig: formData.desig || "",
            SSN: formData.ssn ? formData.ssn.replace(/-/g, '') : "",
            UIC: formData.uic || "",
            ShipStation: formData.station || "",
            PromotionStatus: formData.promo || "",
            BilletSubcat: formData.billetSubcat || "",
            
            // Dates - Ensure these are either NULL or valid timestamps
            DateReported: formData.dateRep || null,
            FromDate: formData.fromPeriod || null,
            ToDate: formData.toPeriod || null,
            DateCounseled: formData.dateCounseled || "",

            // Booleans - NAVFIT98 prefers 1/0 for SQLite compatibility
            Active: 1, // Forced to 1 for visibility
            TAR: formData.dutyStatus === 'TAR' ? 1 : 0,
            Inactive: 0,
            ATADSW: 0,
            Periodic: formData.occasion === 'Periodic' ? 1 : 0,
            DetInd: 0,
            Frocking: 0,
            Special: 0,
            NOB: formData.notObserved ? 1 : 0,
            Regular: 1, 
            Concurrent: 0,
            OpsCdr: 0,

            // Reporting Senior Info
            ReportingSenior: formData.reportSenior || "",
            RSGrade: formData.reportGrade || "",
            RSDesig: formData.reportDesig || "",
            RSTitle: formData.reportTitle || "",
            RSUIC: formData.reportUIC || "",
            RSSSN: formData.reportSSN ? formData.reportSSN.replace(/-/g, '') : "",
            RSAddress: formData.seniorAddress || "",

            // Trait Scores & QUAL
            PROF: formData.proExpert ? parseInt(formData.proExpert, 10) : 0,
            QUAL: formData.professionalism ? parseInt(formData.professionalism, 10) : 0, // Added QUAL
            EO: formData.cmeo ? parseInt(formData.cmeo, 10) : 0,
            MIL: formData.bearing ? parseInt(formData.bearing, 10) : 0,
            PA: 0, // Performance Assessment placeholder
            TEAM: formData.teamwork ? parseInt(formData.teamwork, 10) : 0,
            LEAD: formData.leadership ? parseInt(formData.leadership, 10) : 0,
            MIS: formData.missAccomp ? parseInt(formData.missAccomp, 10) : 0,
            TAC: formData.tactPerform !== "NOB" ? parseInt(formData.tactPerform, 10) : 0,

            // Other
            Achievements: formData.cmdEmployAch || "",
            PrimaryDuty: formData.primaryDuty || "",
            Duties: formData.duties || "",
            Comments: formData.comments || "",
            RecommendA: formData.milestoneOne || "",
            RecommendB: formData.milestoneTwo || "",
            PromotionRecom: formData.promotion ? parseInt(formData.promotion, 10) : 0
        };

        try {
            const result = await window.api.saveFitrep(mappedData, activeSqliteDb);
            if (result.success) {
                triggerNotification("Success", "Report saved to database!", false);
                setIsSaved(true);
                setHasUnsavedChanges(false);
                setSelectedReport(mappedData); // Cache for PDF logic
                // No resetForm() here!
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
        triggerNotification("Processing", "Generating ACCDB... this may take a moment.", false);
        const result = await window.api.exportACCDB();
        if (result.success) {
            triggerNotification("Success", `ACCDB file exported successfully!`, false);
        } else {
            if (result.error && result.error.includes("cancelled")) {
                setShowModal(false);
            } else {
                triggerNotification("Error", result.error || "Failed to generate ACCDB.", true);
            }
        }
    };

    const handleSQLiteExport = async () => {
        triggerNotification("Processing", "Generating SQLite... this may take a moment.", false);
        const result = await window.api.exportSQLite();
        if (result.success) {
            triggerNotification("Success", `SQLite file exported successfully!`, false);
        } else {
            if (result.error && result.error.includes("cancelled")) {
                setShowModal(false);
            } else {
                triggerNotification("Error", result.error || "Failed to generate SQLite.", true);
            }
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
        formData, message, setMessage, showModal, setShowModal, modalContent,
        handleChange, handlePDFExport, calculateTraitAverage, handleSaveFitrep,
        handleACCDBExport, handleSQLiteExport, isSaved, hasUnsavedChanges, getError
    };
}