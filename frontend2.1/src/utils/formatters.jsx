/** formatting of each block */

const validators = {
// Block 1
name: (val) => {
  if (!val) return { isError: false, note: "" };
  const nameRegex = /^[A-Z]+,\s[A-Z]+(\s[A-Z])?(\s(JR|SR|IV|V|I{1,3}))?$/;
  const isValid = nameRegex.test(val.trim());
  return { 
    isError: !isValid, 
    note: isValid ? "" : "Required Format: LAST, FIRST MI (optional) SUFFIX (optional)" 
  };
},
  
  // Block 2
  grade: (val) => {
    if (!val) return { isError: false, note: "" };
    const validGrades = ['ENS', 'LTJG', 'LT', 'LCDR', 'CDR', 'CAPT', 'CHW02', 'CHW03', 'CHW04'];
    const isValid = validGrades.includes(val.trim().toUpperCase());
    return { 
      isError: !isValid, 
      note: "Use standard Navy rank (e.g., LT, CDR)" 
    };
  },
  
  // Block 3
  desig: (val) => {
    if (!val) return { isError: false, note: "" };
    const onlyNumbers = /^\d+$/.test(val);
    if (!onlyNumbers) return { isError: true, note: "Numbers only" };
    return { 
      isError: val.length !== 4, 
      note: val.length !== 4 ? "Standard Navy desig length is 4 numbers" : "" 
    };
  },

  // Block 4: SSN
  ssn: (val) => {
    // If the field is empty, don't show an error
    if (!val || val.length === 0) return { isError: false, note: "" };

    // Strict regex: exactly 3 digits, dash, 2 digits, dash, 4 digits
    const isStrictFormat = /^\d{3}-\d{2}-\d{4}$/.test(val);

    return { 
      isError: !isStrictFormat, 
      note: isStrictFormat ? "" : "Required format: 000-00-0000"
    };
  },
  
  // Block 6
  uic: (val) => {
    if (!val) return { isError: false, note: "" };
    const onlyNumbers = /^\d+$/.test(val);
    if (!onlyNumbers) return { isError: true, note: "Numbers only" };
    return { 
      isError: val.length !== 5, 
      note: val.length !== 5 ? "Standard Navy UIC is 5 numbers" : "" 
    };
  },

  // Block 7
  station: (val) => {
    if (!val || val.trim().length === 0) {
      return { isError: false, note: "" }; // Optional: change isError to true if mandatory
    }
    // Navy forms often have character limits for command names
    const isTooLong = val.length > 30; 
    return {
      isError: isTooLong,
      note: isTooLong ? "Command name too long for box" : ""
    };
  },



// Block 14 Validator
fromPeriod: (val, formData) => {
  if (!val || !formData?.dateRep) return { isError: false, note: "" };

  const fromRaw = convertNavyToRaw(val);
  const repRaw = convertNavyToRaw(formData.dateRep);

  // If both successfully converted to YYYY-MM-DD
  if (fromRaw && repRaw) {
    const fromDate = new Date(fromRaw).getTime();
    const reportedDate = new Date(repRaw).getTime();

    if (fromDate < reportedDate) {
      return { 
        isError: true, 
        note: "From Date cannot be before Date Reported" 
      };
    }
  }
  return { isError: false, note: "" };
},

// Block 15 Validator
toPeriod: (val, formData) => {
  if (!val || !formData?.fromPeriod) return { isError: false, note: "" };

  try {
    const toRaw = convertNavyToRaw(val);
    const fromRaw = convertNavyToRaw(formData.fromPeriod);

    if (toRaw && fromRaw) {
      const toDate = new Date(toRaw);
      const fromDate = new Date(fromRaw);

      if (toDate <= fromDate) {
        return { isError: true, note: "To Date must be after From Date" };
      }
    }
  } catch (e) {
    return { isError: false, note: "" };
  }
  return { isError: false, note: "" };
},
  // Block 20
  physicalRead: (val) => {
    if (!val) return { isError: false, note: "" };
    
    // Standard Navy codes often use combinations of P, B, F, M, W, N
    const navyCodeRegex = /^[PBFMWN]$/;
    const isValid = navyCodeRegex.test(val);
    
    return {
      isError: !isValid,
      note: isValid ? "" : "Use Navy codes (P, B, F, M, W, N)"
    };
  },

  // Block 22
  reportSenior: (val) => {
    if (!val) return { isError: false, note: "" };
    const nameRegex = /^[A-Z]+,\s[A-Z]+(\s[A-Z])?(\s(JR|SR|IV|V|I{1,3}))?$/;
    const isValid = nameRegex.test(val.trim());
    return { 
      isError: !isValid, 
      note: isValid ? "" : "Required Format: LAST, FIRST MI (optional) SUFFIX (optional)" 
    };
  },

  // Block 23
  reportGrade: (val) => {
    if (!val) return { isError: false, note: "" };
    // Reporting Seniors are usually LT and above
    const seniorGrades = ['LT', 'LCDR', 'CDR', 'CAPT', 'RDML', 'RADM', 'VADM', 'ADM', 'GS13', 'GS14', 'GS15'];
    const isValid = seniorGrades.includes(val.trim().toUpperCase());
    
    return {
      isError: !isValid,
      note: isValid ? "" : "Use senior rank (e.g., CDR, CAPT)"
    };
  },

  // Block 24
  reportDesig: (val) => {
    if (!val) return { isError: false, note: "" };
    const onlyNumbers = /^\d+$/.test(val);
    if (!onlyNumbers) return { isError: true, note: "Numbers only" };
    return { 
      isError: val.length !== 4, 
      note: val.length !== 4 ? "Standard Navy desig length is 4 numbers" : "" 
    };
  },

  // Block 25
  reportTitle: (val) => {
    if (!val) return { isError: false, note: "" };
    // Most NAVFIT boxes for title only fit about 15-20 characters
    const isTooLong = val.length > 14;
    return { 
      isError: isTooLong, 
      note: isTooLong ? "Title cannot be longer than 14 characters; use abbreviations CO, OIC, XO, DEPT HEAD" : "" 
    };
  },

  // Block 26
  reportUIC: (val) => {
    if (!val) return { isError: false, note: "" };
    const onlyNumbers = /^\d+$/.test(val);
    if (!onlyNumbers) return { isError: true, note: "Numbers only" };
    return { 
      isError: val.length !== 5, 
      note: val.length !== 5 ? "Standard Navy UIC is 5 numbers" : "" 
    };
  },

  // Block 27: SSN 
  reportSSN: (val) => {
    // If the field is empty, don't show an error
    if (!val || val.length === 0) return { isError: false, note: "" };

    // Strict regex: exactly 3 digits, dash, 2 digits, dash, 4 digits
    const isStrictFormat = /^\d{3}-\d{2}-\d{4}$/.test(val);

    return { 
      isError: !isStrictFormat, 
      note: isStrictFormat ? "" : "Required format: 000-00-0000"
    };
  },

  // Block 28
  cmdEmployAch: (val) => {
    const maxLength = 276;
    if (!val) return { isError: false, note: "" };
    
    const isOver = val.length > maxLength;
    return { 
      isError: isOver, 
      note: isOver ? "Exceeds Max Character Length (275)" : "" 
    };
  },

  // Block 29
  primaryDuty: (val) => {
    if (!val) return { isError: false, note: "" };
    // Abbreviation box
    const isTooLong = val.length > 14;
    return { 
      isError: isTooLong, 
      note: isTooLong ? "Abbreviation must be less than 15 characters" : "" 
    };
  },
  duties: (val) => {
    const maxLength = 300; // Adjust to your config
    if (!val) return { isError: false, note: "" };
    const isOver = val.length > maxLength;
    return { 
      isError: isOver, 
      note: isOver ? "Duties text must be less than 276 characters" : "" 
    };
  },

  // Block 30
dateCounseled: (val) => {
  // 1. If the field is empty, do nothing (No error)
  if (!val || val.trim() === "") return { isError: false };

  // 2. If it matches a valid non-date code, do nothing (No error)
  const navyCodes = ["NOT REQ", "NOT PERF", "WAIVED", "PNA"];
  if (navyCodes.includes(val)) return { isError: false };

  // 3. The Date Validation
  // Matches 2 digits + 3 letters + 2 digits (e.g., 14FEB20)
  // Added \s? to allow for a space if the user accidentally hits it
  const dateRegex = /^\d{2}[A-Z]{3}\s?\d{2}$/; 

  if (!dateRegex.test(val)) {
    return { 
      isError: true, 
      note: "Invalid Format. Use YYMMMDD (e.g., 14FEB20) or select a valid code." 
    };
  }

  // 4. If it passes the regex, it's a valid date
  return { isError: false };
},
  
  // Block 31
  counselor: (val) => {
    if (!val) return { isError: false, note: "" };
    // Check for the standard: LAST, FIRST MI
    const nameRegex = /^[A-Z]+,\s[A-Z](\s[A-Z])?$/;
    const isValid = nameRegex.test(val);
    return { 
      isError: !isValid, 
      note: isValid ? "" : "Format: LAST, FIRST INITIAL MI" 
    };
  },

  // Block 40
  milestoneOne: (val) => {
    if (!val) return { isError: false, note: "" };
    const isTooLong = val.length > 18;
    return { isError: isTooLong, note: isTooLong ? "Too long" : "" };
  },
  milestoneTwo: (val) => {
    if (!val) return { isError: false, note: "" };
    const isTooLong = val.length > 18;
    return { isError: isTooLong, note: isTooLong ? "Too long" : "" };
  },


 // Block 41
comments: (val, formData) => {
  if (!val) {
    // If Block 20 has 'B', comments cannot be empty
    if (formData.physicalRead?.includes('B')) {
      return { isError: true, note: "BCA failure (Blk 20) must be substantiated here." };
    }
    return { isError: false, note: "" };
  }

  // 1. Line Count Check (Navy max is 18 lines)
  const lineCount = val.split('\n').length;
  if (lineCount > 18) {
    return { 
      isError: true, 
      note: `Exceeds 18-line limit (Current: ${lineCount})` 
    };
  }

  // 2. Physical Readiness Check
  // If Block 20 contains 'B' (BCA failure), ensure it's mentioned in comments
  if (formData.physicalRead?.includes('B')) {
    const mentionsBCA = /BCA|BODY COMPOSITION|FAILED/i.test(val);
    if (!mentionsBCA) {
      return { 
        isError: true, // Treated as error because it's a mandatory administrative requirement
        note: "BCA failure in Block 20 requires substantiating comments." 
      };
    }
  }

  return { isError: false, note: "" };
},
}

export const formatDateToNavy = (dateString) => {
  if (!dateString) return "";
  
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  
  // Create the date object
  const date = new Date(dateString);
  
  /* THE FIX: Add the timezone offset back in minutes. 
     This prevents the date from "jumping" to the previous day.
  */
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());

  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);

  return `${year}${month}${day}`;
};

export const convertNavyToRaw = (navyDate) => {
  if (!navyDate || navyDate.length < 7) return "";
  
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  
  const yearPart = "20" + navyDate.substring(0, 2);
  const monthPart = navyDate.substring(2, 5);
  const dayPart = navyDate.substring(5, 7);
  
  const monthIndex = months.indexOf(monthPart.toUpperCase());
  if (monthIndex === -1) return "";
  
  // Returns "2026-03-15" format required by <input type="date">
  return `${yearPart}-${String(monthIndex + 1).padStart(2, '0')}-${dayPart}`;
};

export default validators;
