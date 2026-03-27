class FitRepData {
    /**
     * Creates a FitRep data object.
     * @param {Object} initialData - Object containing report data (from UI or DB). 
     * Defaults to empty for a new report.
     */
    constructor(initialData = {}) {
        // --- 1. Personal & Admin ---
        this.FullName = initialData.FullName || "";
        this.Rate = initialData.Rate || "";
        this.Desig = initialData.Desig || "";
        this.SSN = initialData.SSN || "";
        
        // Duty Status (UI Checkboxes)
        this.Active = !!initialData.Active;
        this.TAR = !!initialData.TAR;
        this.Inactive = !!initialData.Inactive;
        this.ATADSW = !!initialData.ATADSW;

        this.UIC = initialData.UIC || "";
        this.ShipStation = initialData.ShipStation || "";
        this.PromotionStatus = initialData.PromotionStatus || "";
        this.DateReported = initialData.DateReported || "";

        // --- 2. Occasion of Report ---
        this.Periodic = !!initialData.Periodic;
        this.DetInd = !!initialData.DetInd;
        this.DetRS = !!initialData.DetRS;
        this.Special = !!initialData.Special;
        
        // Dates (Period of Report)
        this.FromDate = initialData.FromDate || "";
        this.ToDate = initialData.ToDate || "";
        this.NOB = !!initialData.NOB;

        // --- 3. Type of Report ---
        this.Regular = !!initialData.Regular;
        this.Concurrent = !!initialData.Concurrent;
        this.OpsCdr = !!initialData.OpsCdr;

        // --- 4. Physical & Billet ---
        this.PhysicalReadiness = initialData.PhysicalReadiness || "";
        this.BilletSubcat = initialData.BilletSubcat || "";

        // --- 5. Reporting Senior ---
        this.ReportingSenior = initialData.ReportingSenior || "";
        this.RSGrade = initialData.RSGrade || "";
        this.RSDesig = initialData.RSDesig || "";
        this.RSTitle = initialData.RSTitle || "";
        this.RSUIC = initialData.RSUIC || "";
        this.RSSSN = initialData.RSSSN || "";
        this.RSAddress = initialData.RSAddress || "";

        // --- 6. Duties & Achievements ---
        this.Achievements = initialData.Achievements || ""; 
        this.PrimaryDuty = initialData.PrimaryDuty || "";   
        this.Duties = initialData.Duties || "";             

        // --- 7. Counseling ---
        this.DateCounseled = initialData.DateCounseled || "";
        this.Counseler = initialData.Counseler || "";

        // --- 8. Performance Traits (UI Inputs: 1-5, "NOB", or null) ---
        this.PROF = initialData.PROF || "";
        this.EO = initialData.EO || "";
        this.MIL = initialData.MIL || "";
        this.TEAM = initialData.TEAM || "";
        this.MIS = initialData.MIS || "";
        this.LEAD = initialData.LEAD || "";
        this.TAC = initialData.TAC || "";

        // --- 9. Recommendations & Comments ---
        this.RecommendScreening = initialData.RecommendScreening || initialData.RecommendA || ""; 
        // Handle case where DB split them, but UI might combine them
        if (initialData.RecommendB) {
             this.RecommendScreening += "\n" + initialData.RecommendB;
        }
        this.Comments = initialData.Comments || "";
        
        // Promotion Rec Code (1=NOB ... 6=EP)
        this.PromotionRecom = initialData.PromotionRecom || "";

        // --- 10. Summary Group (Counts) ---
        this.SummarySP = initialData.SummarySP || "";
        this.SummaryProg = initialData.SummaryProg || "";
        this.SummaryProm = initialData.SummaryProm || "";
        this.SummaryMP = initialData.SummaryMP || "";
        this.SummaryEP = initialData.SummaryEP || "";
        this.SummaryNOB = initialData.SummaryNOB || ""; 

        // --- 11. Signatures & Averages ---
        this.RSCA = initialData.RSCA || ""; // Summary Group Average
        
        // Statement Intent (Booleans)
        this.StatementYes = !!initialData.StatementYes;
        this.StatementNo = !!initialData.StatementNo;

        // Block 47 (Concurrent Report Senior)
        // Check if pre-combined or separate fields exist
        if (initialData.RRSCombined) {
            // If UI passed the full string already
            this.RRSName = initialData.RRSCombined; 
            this.RRSGrade = "";
            this.RRSCommand = "";
            this.RRSUIC = "";
        } else {
            // If coming from DB fields
            this.RRSName = initialData.RRSLastName ? `${initialData.RRSLastName}, ${initialData.RRSFI} ${initialData.RRSMI}` : "";
            this.RRSGrade = initialData.RRSGrade || "";
            this.RRSCommand = initialData.RRSCommand || "";
            this.RRSUIC = initialData.RRSUIC || "";
        }
    }

    /**
     * Calculates the Member Trait Average (e.g., 3.45) on the fly based on current field values.
     */
    get MemberTraitAverage() {
        const traits = [this.PROF, this.EO, this.MIL, this.TEAM, this.MIS, this.LEAD, this.TAC];
        let sum = 0;
        let count = 0;

        traits.forEach(t => {
            if (String(t).toUpperCase() === 'NOB' || t === "") return;
            const val = parseFloat(t);
            if (!isNaN(val) && val > 0) {
                sum += val;
                count++;
            }
        });

        if (count === 0) return "NOB";
        return (sum / count).toFixed(2);
    }

    /**
     * Combines RRS info for Block 47 text box.
     */
    get RRSCombined() {
        // If RRSName seems to hold the whole string (from UI edit), return it directly
        if (this.RRSName && this.RRSName.includes(',')) {
             // Basic heuristic: if it looks like "Name, Grade..."
             return this.RRSName; 
        }

        let parts = [];
        if (this.RRSName) parts.push(this.RRSName);
        if (this.RRSGrade) parts.push(this.RRSGrade);
        if (this.RRSCommand) parts.push(this.RRSCommand);
        if (this.RRSUIC) parts.push(this.RRSUIC);
        return parts.join(", ");
    }

    /**
     * Generates a Mock FitRepData object for testing PDF generation.
     * @returns {FitRepData}
     */
    static mock() {
        return new FitRepData({
            FullName: "DOE, JOHN Q.",
            Rate: "LT",
            Desig: "1110",
            SSN: "000-00-0000",
            Active: true,
            UIC: "55555",
            ShipStation: "USS NEVERDOCK (DDG 00)",
            PromotionStatus: "REG",
            DateReported: "2023-01-01",
            
            Periodic: true,
            FromDate: "2023-01-01",
            ToDate: "2023-12-31",
            Regular: true,
            
            PhysicalReadiness: "P",
            BilletSubcat: "DIV OFF",
            
            ReportingSenior: "CAPTAIN, I. M.",
            RSGrade: "CAPT",
            RSDesig: "1110",
            RSTitle: "CO",
            RSUIC: "55555",
            RSSSN: "999-99-9999",
            
            Achievements: "Specific accomplishment one.\nSpecific accomplishment two.",
            PrimaryDuty: "DIVO",
            Duties: "Responsible for division training, maintenance, and personnel.",
            
            DateCounseled: "2023-07-15",
            Counseler: "CDR XO",
            
            // Traits (Text inputs for "X" marking)
            PROF: "4",
            EO: "5",
            MIL: "3",
            TEAM: "NOB",
            MIS: "4",
            LEAD: "5",
            TAC: "4",
            
            RecommendScreening: "Department Head\nPost-Graduate School",
            Comments: "1. LT Doe is a superstar. He fixed the entire ship with duct tape.\n2. Highly Recommended.",
            
            PromotionRecom: "6", // Early Promote
            
            SummarySP: "0",
            SummaryProg: "0",
            SummaryProm: "2",
            SummaryMP: "5",
            SummaryEP: "1", // Matches this sailor
            
            RSCA: "4.12",
            StatementNo: true
        });
    }
}

module.exports = FitRepData;
