const fs = require('fs');

class FitRepMapper {
    constructor() {
        this.pdfMap = {};
    }

    mapDataModel(data) {
        if (!data) return;

        // --- Block 1-4: Personal ---
        this.map("f1_01", data.FullName);
        this.map("f1_02", data.Rate);
        this.map("f1_03", data.Desig);
        this.map("f1_04", this.formatSSN(data.SSN));

        // --- Block 5: Status (CHECKBOXES -> "Yes") ---
        if (data.Active)   this.pdfMap["f1_05_ACT"]     = "Yes";
        if (data.TAR)      this.pdfMap["f1_05_TAR"]     = "Yes";
        if (data.Inactive) this.pdfMap["f1_05_INACT"]   = "Yes";
        if (data.ATADSW)   this.pdfMap["f1_05_AT_ADSW"] = "Yes";

        // --- Block 6-9 ---
        this.map("f1_06", data.UIC);
        this.map("f1_07", data.ShipStation);
        this.map("f1_08", data.PromotionStatus);
        this.mapDate("f1_09", data.DateReported);

        // --- Block 10-13: Occasion (CHECKBOXES -> "Yes") ---
        if (data.Periodic) this.pdfMap["f1_10"] = "Yes";
        if (data.DetInd)   this.pdfMap["f1_11"] = "Yes";
        if (data.DetRS)    this.pdfMap["f1_12"] = "Yes";
        if (data.Special)  this.pdfMap["f1_13"] = "Yes";
        
        // --- Block 14-16: Period & NOB ---
        this.mapDate("f1_14", data.FromDate);
        this.mapDate("f1_15", data.ToDate);
        if (data.NOB)      this.pdfMap["f1_16"] = "Yes"; // Checkbox

        // --- Block 17-19: Type (CHECKBOXES -> "Yes") ---
        if (data.Regular)    this.pdfMap["f1_17"] = "Yes";
        if (data.Concurrent) this.pdfMap["f1_18"] = "Yes";
        if (data.OpsCdr)     this.pdfMap["f1_19"] = "Yes";

        // --- Block 20-27: Standard Text ---
        this.map("f1_20", data.PhysicalReadiness);
        this.map("f1_21", data.BilletSubcat);
        this.map("f1_22", data.ReportingSenior);
        this.map("f1_23", data.RSGrade);
        this.map("f1_24", data.RSDesig);
        this.map("f1_25", data.RSTitle);
        this.map("f1_26", data.RSUIC);
        this.map("f1_27", this.formatSSN(data.RSSSN));

        // --- Block 28-29: Duties ---
        this.map("f1_28", data.Achievements);
        this.map("f1_29a", data.PrimaryDuty); // Maps to the small Abbrev box
        this.map("f1_29b", data.Duties ? String(data.Duties).toUpperCase() : data.Duties);

        // --- Block 30-31: Counseling ---
        this.mapDate("f1_30", data.DateCounseled);
        this.map("f1_31", data.Counseler);
        // f1_32 (Signature) -> SKIPPED per instructions

        // --- Block 33-39: Performance Traits (TEXT BOXES -> "X") ---
        // You specified these are Text Boxes, so we send "X" to the selected one.
        this.mapTraitText("f1_33", data.PROF); 
        this.mapTraitText("f1_34", data.QUAL); // FIX: Ensure QUAL maps to Block 34
        this.mapTraitText("f1_35", data.MIL); 
        this.mapTraitText("f1_36", data.TEAM); 
        this.mapTraitText("f1_37", data.MIS); 
        this.mapTraitText("f1_38", data.LEAD); 
        this.mapTraitText("f1_39", data.TAC);

        // --- Block 40-41: Comments ---
        this.map("f1_40", data.RecommendScreening);
        this.map("f1_41", data.Comments);

        // --- Block 42: Promotion Rec (CHECKBOXES -> "Yes") ---
        this.mapPromotionCheckbox(data.PromotionRecom);

        // --- Block 43: Summary Group (Text Counts) ---
        this.map("f1_43_NOB", data.SummaryNOB);
        this.map("f1_43_SigProb", data.SummarySP);
        this.map("f1_43_Prog", data.SummaryProg);
        this.map("f1_43_Prom", data.SummaryProm);
        this.map("f1_43_MP", data.SummaryMP);
        this.map("f1_43_EP", data.SummaryEP);

        // --- Block 44: Address ---
        this.map("f1_44", data.RSAddress);

        // --- Block 45: Averages ONLY (Signature Skipped) ---
        this.map("f1_45_member_trait_avg", data.MemberTraitAverage);
        this.map("f1_45_sum_grp_avg", data.RSCA);
        // Signature/Date skipped

        // --- Block 46: Statement (CHECKBOXES -> "Yes") ---
        if (data.StatementYes) this.pdfMap["f1_46_yes"] = "Yes";
        if (data.StatementNo)  this.pdfMap["f1_46_no"]  = "Yes";
        // Signature/Date skipped

        // --- Block 47: Regular Reporting Senior ---
        // Note: You mentioned 47 are checkboxes, but usually this block
        // requires the text details (Name/Command). 
        // I am mapping the TEXT to f1_47. 
        // If f1_47 is truly a checkbox in your PDF, this data will not appear.
        this.map("f1_47", data.RRSCombined);
    }

    // --- Helpers ---

    /**
     * Formats a raw SSN string (e.g. "123456789") into dashed format "123-45-6789".
     * If already formatted or not 9 digits, returns as-is.
     */
    formatSSN(rawSSN) {
        if (!rawSSN) return rawSSN;
        // Strip any existing dashes/spaces to normalize
        const digits = String(rawSSN).replace(/[\s-]/g, '');
        if (digits.length === 9 && /^\d{9}$/.test(digits)) {
            return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
        }
        return String(rawSSN); // Return as-is if not a clean 9-digit SSN
    }

    map(field, value) {
        if (value !== undefined && value !== null) {
            this.pdfMap[field] = String(value);
        }
    }

    mapDate(field, dateVal) {
        if (!dateVal) return;
        try {
            this.pdfMap[field] = String(dateVal).substring(0, 10);
        } catch (e) {
            this.pdfMap[field] = String(dateVal);
        }
    }

    /**
     * Maps a score to a specific TEXT BOX by marking it with "X".
     */
    mapTraitText(baseName, score) {
        if (!score) return;
        
        let targetSuffix = "";
        
        if (String(score).toUpperCase() === 'NOB') {
            targetSuffix = "NOB";
        } else {
            const s = parseInt(score);
            if (!isNaN(s) && s >= 1 && s <= 5) {
                targetSuffix = String(s); // e.g. "4"
            }
        }

        if (targetSuffix) {
            // Sends "X" because these are Text Boxes
            this.pdfMap[`${baseName}_${targetSuffix}`] = "X";
        }
    }

    /**
     * Maps Promotion Rec code to CHECKBOXES by marking them "Yes".
     */
    mapPromotionCheckbox(code) {
        if (!code) return;
        const c = parseInt(code);
        
        // Keys based on your PDF Inspector output
        const keys = {
            1: "f42_NOB",
            2: "f1_42_SigProb",
            3: "f1_42_Prog",
            4: "f42_Prom",
            5: "f1_42_MP",
            6: "f1_42_EP"
        };
        
        if (keys[c]) {
            this.pdfMap[keys[c]] = "Yes";
        }
    }

    exportJson(outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(this.pdfMap, null, 2));
    }
}

module.exports = FitRepMapper;
