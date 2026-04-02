import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/FitrepForm.css'; 
import validators from '../../utils/formatters';
import PerformanceRow from '../../components/PerformanceRow';
import SumPromo from '../../components/SumPromo';
import PromoRec from '../../components/PromoRec';
import { FITREP_CONFIG, TRAIT_STANDARDS } from '../../constants/fitrepConfig';
import useFitrep from '../../hooks/useFitrep';
import Login from '../../components/Login';

export default function FitrepForm() {

  const location = useLocation();
  const navigate = useNavigate();
    
  // Extract the routing data passed by HomePage
  const { 
      dbPath = null, 
      reportId = null, 
      fitrep = null 
  } = location.state || {};

  // Track the report ID so we know if we are updating or inserting
  const [currentReportId, setCurrentReportId] = useState(reportId);
  const [isDateRepFocused, setIsDateRepFocused] = useState(false);
  const [isFromFocused, setIsFromFocused] = useState(false);
  const [isToFocused, setIsToFocused] = useState(false);

  // Pass the dynamic dbPath to your hook instead of the hardcoded one!
  const {
    formData, 
    setFormData,
    handleChange, 
    handleSaveFitrep,
    handlePDFExport,
    calculateTraitAverage,
    showModal,
    setShowModal,
    modalContent,
    isSaved,
    hasUnsavedChanges, 
    handleACCDBExport,
    getError,
    raterGroupSummary
  } = useFitrep(dbPath);

  // Pre-fill data if editing an existing report
  useEffect(() => {
    const intToPromoRec = (val) => {
        const map = { 0: 'NOB', 1: 'SIGNIFICANT PROBLEMS', 2: 'PROGRESSING', 3: 'PROMOTABLE', 4: 'MUST PROMOTE', 5: 'EARLY PROMOTE' };
        return map[val] || '';
    };

    // Convert a DB trait integer (1-5 or 0) to the radio value format ("1.0"-"5.0", "NOB", or "")
    const traitToRadio = (val) => {
        if (!val || val === 0 || val === '0') return '';
        const str = String(val);
        if (str.toUpperCase() === 'NOB') return 'NOB';
        const num = parseFloat(str);
        if (!isNaN(num) && num >= 1 && num <= 5) return num.toFixed(1);
        return '';
    };

    const populateForm = (data) => {
        setFormData(prev => ({
            ...prev,
            name: data.FullName || '',
            grade: data.Rate || '',
            desig: data.Desig || '',
            ssn: data.SSN || '',
            uic: data.UIC || '',
            station: data.ShipStation || '',
            promo: data.PromotionStatus || '',
            dateRep: data.DateReported || '',
            fromPeriod: data.FromDate || '',
            toPeriod: data.ToDate || '',
            reportSenior: data.ReportingSenior || '',
            reportGrade: data.RSGrade || '',
            reportDesig: data.RSDesig || '',
            reportTitle: data.RSTitle || '',
            reportUIC: data.RSUIC || '',
            reportSSN: data.RSSSN || '',
            seniorAddress: data.RSAddress || '',
            cmdEmployAch: data.Achievements || '',
            primaryDuty: data.PrimaryDuty || '',
            duties: data.Duties || '',
            dateCounseled: data.DateCounseled || '',
            counselor: data.Counseler || '',
            proExpert: traitToRadio(data.PROF),
            cmeo: traitToRadio(data.EO),
            bearing: traitToRadio(data.MIL),
            teamwork: traitToRadio(data.TEAM),
            leadership: traitToRadio(data.LEAD),
            missAccomp: traitToRadio(data.MIS),
            tactPerform: traitToRadio(data.TAC),
            milestoneOne: data.RecommendA || '',
            milestoneTwo: data.RecommendB || '',
            comments: data.Comments || '',
            promotion: intToPromoRec(data.PromotionRecom),
            dutyStatus: data.Active ? 'ACT' : data.TAR ? 'FTS' : data.Inactive ? 'INACT' : data.ATADSW ? 'AT/ADSW/' : '',
            occasion: data.Periodic ? 'Periodic' : data.DetInd ? 'Detachment of Individual' : data.Frocking ? 'Detachment of Reporting Senior' : data.Special ? 'Special' : '',
            notObserved: data.NOB ? 'Not Observed Report' : '',
            reportType: data.Regular ? 'Regular' : data.Concurrent ? 'Concurrent' : data.OpsCdr ? 'Ops Cdr' : data.ReportType || '',
            billetSub: data.BilletSubcat || '',
            physicalRead: data.PhysicalReadiness || '',
        }));
    };

    if (reportId && dbPath && setFormData) {
        // Fetch the full report from the database
        window.api.loadFitrep({ dbPath, reportId }).then((fullReport) => {
            if (fullReport) {
                populateForm(fullReport);
            }
        });
    }

    // Menu Listener Logic
    if (window.api && window.api.onMenuNavigateHome) {
      // We store the function so we can "turn it off" later
      const removeListener = window.api.onMenuNavigateHome(() => {
          navigate('/'); 
      });

      // This "return" tells React: "If this component closes or reloads, 
      // stop listening to the menu so we don't have ghost listeners."
      return () => {
        if (typeof removeListener === 'function') {
          removeListener();
        }
      };
    }
    
  }, [reportId, dbPath, setFormData, navigate]);

  // Helper to convert Browser Date (YYYY-MM-DD) to Navy Format (YYMMM DD)
  const formatDateToNavy = (dateString) => {
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

  // Helper to convert "26MAR 03" back to "2026-03-03" for the browser
  const convertNavyToRaw = (navyDate) => {
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

  // --- THE ACCURATE LINE COUNTER ---
const calculateTrueLines = () => {
  const textarea = document.querySelector('.block-41-textarea');
  // If no textarea or no text, it's just 1 line
  if (!textarea || !formData.comments) return 1;

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseInt(style.lineHeight) || 20;

  // 1. Create a hidden "Ghost" div to mimic the textarea
  const ghost = document.createElement('div');
  
  // 2. Copy the EXACT styles that affect text wrapping
  ghost.style.width = style.width;
  ghost.style.fontFamily = style.fontFamily;
  ghost.style.fontSize = style.fontSize;
  ghost.style.lineHeight = style.lineHeight;
  ghost.style.padding = style.padding;
  ghost.style.boxSizing = 'border-box';
  ghost.style.whiteSpace = 'pre-wrap';
  ghost.style.wordWrap = 'break-word';
  
  // 3. Hide it from the user
  ghost.style.visibility = 'hidden';
  ghost.style.position = 'absolute';
  ghost.style.top = '-9999px';

  // 4. Set the text and measure
  ghost.textContent = formData.comments || ""; // Use the state directly
  document.body.appendChild(ghost);
  const textHeight = ghost.getBoundingClientRect().height;
  document.body.removeChild(ghost);

  // 5. Math: Total Height divided by height of one line
  return Math.max(1, Math.round(textHeight / lineHeight));
};

const totalLines = calculateTrueLines();

  return (
    <div className="navfit-paper">
      
      {/* ADDED: Back to Database Button */}
      <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'flex-start' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            if (hasUnsavedChanges) {
              const confirm = window.confirm("You have unsaved changes! Are you sure you want to leave without saving?");
              if (!confirm) return;
            }
            navigate('/', { state: { openDb: { name: dbPath.split(/[/\\]/).pop(), path: dbPath } } });
          }}
          style={{ cursor: 'pointer', padding: '5px 10px' }}
        >
          ← Back to Database
        </button>
      </div>

     {/* HEADER SECTION */}
    <div className="navfit-header" style={{ textAlign: 'center', padding: '15px 0' }}>
      <h1 style={{ 
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '24px',                            
        fontWeight: '800',                         
        letterSpacing: '1px',                        
        margin: 0                
      }}>
        FITNESS REPORT & COUNSELING RECORD (W2-O6)
      </h1>
    </div>

    <div className="navfit-row" style={{ borderLeft: '1px solid black', borderRight: '1px solid black', borderTop: '1px solid black', borderBottom: 'none' }}>
      {/* BLOCKS 1-4: THE TOP ROW */}
      {/* BLOCK 1 */}
      <div className="navfit-row">
        <div 
          className={`navfit-cell ${getError('name').isError ? "input-error" : ""}`} 
          style={{ flex: 3}}
        >
          <label>1. Name (Last, First MI Suffix)</label>
          <input 
            className="navfit-input"
            value={formData.name} 
            onChange={(e) => {
              // Keeps the auto-uppercase and regex blocking in the onChange
              const cleanValue = e.target.value.toUpperCase().replace(/[^A-Z,\s-]/g, '');
              handleChange('name', cleanValue);
            }} 
          />
      
          {getError('name').isError && (
            <div className="error-note">
              {getError('name').note}
            </div>
          )}
        </div>


      {/* BLOCK 2: GRADE/RATE */}
      <div 
        className={`navfit-cell ${getError('grade').isError ? "input-error" : ""}`} 
        style={{ flex: 1 }}
      >
        <label>2. Grade/Rate</label>
        <input 
          className="navfit-input"
          value={formData.grade} 
          // Auto-uppercase as they type for Navy standards
          onChange={(e) => handleChange('grade', e.target.value.toUpperCase())}
        />
        
        {/* Show the specific error message from your validators file */}
        {getError('grade').isError && (
          <div className="error-note">
            {getError('grade').note}
          </div>
        )}
      </div>

      {/* BLOCK 3: DESIG */}
      <div 
        className={`navfit-cell ${getError('desig').isError ? "input-error" : ""}`} 
        style={{ flex: 1 }}
      >
        <label>3. Desig</label>
        <input 
          className="navfit-input"
          value={formData.desig} 
          // Removes any non-digits instantly, but allows unlimited length
          onChange={(e) => handleChange('desig', e.target.value.replace(/\D/g, ''))} 
        />
        
        {/* Standard Error Display */}
        {getError('desig').isError && (
          <div className="error-note">
            {getError('desig').note}
          </div>
        )}
      </div>
      
      {/* BLOCK 4: SSN */}
      <div 
        className={`navfit-cell ${getError('ssn').isError ? "input-error" : ""}`} 
        style={{ flex: 1.5 }}
      >
        <label>4. SSN</label>
        <input 
          className="navfit-input"
          value={formData.ssn} 
          onChange={(e) => {
            // Allow only digits and hyphens
            let val = e.target.value.replace(/[^0-9-]/g, '');
            if (val.length > 11) val = val.slice(0, 11);
            handleChange('ssn', val);
          }}
        />

        {/* Display the error message below the input */}
        {getError('ssn').isError && (
          <span className="error-note">
            {getError('ssn').note}
          </span>
        )}
      </div>
      </div>
      </div>
      
      {/* BLOCKS 5-9: THE DUTY STATION ROW */}
      <div className="navfit-row" style={{ borderLeft: '1px solid black', borderRight: '1px solid black', borderTop: 'none', borderBottom: '1px solid black' }}>
        {/* BLOCK 5: DUTY STATUS */}
        <div className="navfit-cell" style={{ flex: 2 }}>
          <label>5. Duty Status</label>
          <div className="radio-group" style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            {['ACT', 'FTS', 'INACT', 'AT/ADSW/'].map((status) => (
              <label key={status} className="radio-label" style={{display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="radio"
                  name="dutyStatus"
                  value={status}
                  checked={formData.dutyStatus === status}
                  onChange={(e) => handleChange('dutyStatus', e.target.value)}
                  onClick={() => { if (formData.dutyStatus === status) handleChange('dutyStatus', ''); }}
                /> 
                {status}
              </label>
            ))}
          </div>
        </div>

      {/* BLOCK 6: UIC */}
      <div 
        className={`navfit-cell ${getError('uic').isError ? "input-error" : ""}`} 
        style={{ flex: 1 }}
      >
        <label>6. UIC</label>
        <input 
          className="navfit-input" // Ensure this matches your CSS for inputs
          value={formData.uic} 
          onChange={(e) => handleChange('uic', e.target.value.replace(/\D/g, ''))} 
        />
        
        {/* Standard Error Display */}
        {getError('uic').isError && (
          <div className="error-note">
            {getError('uic').note}
          </div>
        )}
      </div>

  
        {/* BLOCK 7: SHIP/STATION */}
        <div 
          className={`navfit-cell ${getError('station').isError ? "input-error" : ""}`} 
          style={{ flex: 1.5 }}
        >
          <label>7. Ship/Station</label>
          <input 
            className="navfit-input"
            value={formData.station} 
            // Auto-uppercase to match Navy administrative standards
            onChange={(e) => handleChange('station', e.target.value.toUpperCase())} 
          />
          
          {/* If required and empty, or if it exceeds character limits */}
          {getError('station').isError && (
            <div className="error-note">
              {getError('station').note}
            </div>
          )}
        </div>

        {/*BLOCK 8*/}
        <div className="navfit-cell" style={{ flex: 1 }}>
          <label>8. Promotion Status</label>
          <select 
            value={formData.promo} 
            onChange={(e) => handleChange('promo', e.target.value)}
            className="dropdown-input"
          >
            <option value="">  </option>
            <option value="REGULAR">REGULAR</option>
            <option value="FROCKED">FROCKED</option>
            <option value="SELECTED">SELECTED</option>
            <option value="SPOT">SPOT</option>
          </select>
        </div>
        
      {/* BLOCK 9: DATE REPORTED */}
      <div 
        className={`navfit-cell ${getError('dateRep').isError ? "input-error" : ""}`} 
        style={{ flex: 0.5 }}
      >
        <label>9. Date Reported</label>
        <input 
          // Switch between date (for picking) and text (for Navy display)
          type={isDateRepFocused ? "date" : "text"}
          className="navfit-input calendar-input"
          
          /* If focused, we need to convert the Navy string BACK to YYYY-MM-DD 
            so the calendar knows which day is currently selected.
          */
          value={isDateRepFocused ? convertNavyToRaw(formData.dateRep) : formData.dateRep}
          
          onChange={(e) => {
            const rawValue = e.target.value; // "2026-03-03"
            if (rawValue) {
              // Save it in Navy format for the rest of the app/PDF
              handleChange('dateRep', formatDateToNavy(rawValue));
            }
          }} 

          onFocus={() => setIsDateRepFocused(true)}
          onBlur={() => setIsDateRepFocused(false)}
        />

        {getError('dateRep').isError && (
          <div className="error-note">{getError('dateRep').note}</div>
        )}
      </div>
      </div>

      {/* BLOCKS 10-15 */}
      <div className="navfit-row">
      
      {/* BLOCKS 10-13: OCCASION FOR REPORT */}
      <div className="navfit-cell" style={{ flex: 2.5, borderLeft: '1px solid black' }}>
        <label>Occasion for Report</label>
        <div className="radio-group" style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'nowrap', 
          justifyContent: 'flex-start', 
          alignItems: 'flex-start',     
          gap: '15px', // Slightly reduced gap to accommodate wider labels
          marginTop: '4px' 
        }}>
          {/* 10. Periodic */}
          <label className="radio-label" style={{display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span>10. Periodic</span>
            <input type="radio" value="Periodic" checked={formData.occasion === 'Periodic'} onChange={(e) => handleChange('occasion', e.target.value)} onClick={() => { if (formData.occasion === 'Periodic') handleChange('occasion', ''); }} /> 
          </label>
          
        {/* 11. Detachment of Individual */}
      <label className="radio-label" style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: '4px', 
        width: '110px', // Can be tighter now
        lineHeight: '1.1' 
      }}>
        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>
          11. Detachment<br />of Individual
        </span>
        <input 
          type="radio" 
          value="Detachment of Individual"
          checked={formData.occasion === 'Detachment of Individual'}
          onChange={(e) => handleChange('occasion', e.target.value)}
          onClick={() => { if (formData.occasion === 'Detachment of Individual') handleChange('occasion', ''); }}
          style={{ marginTop: '1px', cursor: 'pointer' }} 
        /> 
      </label>

      {/* 12. Detachment of Reporting Senior */}
      <label className="radio-label" style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: '4px', 
        width: '120px', 
        lineHeight: '1.1' 
      }}>
        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>
          12. Detachment of<br />Reporting Senior
        </span>
        <input 
          type="radio" 
          value="Detachment of Reporting Senior"
          checked={formData.occasion === 'Detachment of Reporting Senior'}
          onChange={(e) => handleChange('occasion', e.target.value)}
          onClick={() => { if (formData.occasion === 'Detachment of Reporting Senior') handleChange('occasion', ''); }}
          style={{ marginTop: '1px', cursor: 'pointer' }} 
        /> 
      </label>
          
          {/* 13. Special */}
          <label className="radio-label" style={{display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span>13. Special</span>
            <input type="radio" value="Special" checked={formData.occasion === 'Special'} onChange={(e) => handleChange('occasion', e.target.value)} onClick={() => { if (formData.occasion === 'Special') handleChange('occasion', ''); }} /> 
          </label>
        </div>
      </div>
      
  {/* BLOCKS 14 & 15: PERIOD OF REPORT */}
  <div 
    className={`navfit-cell ${ (getError('fromPeriod').isError || getError('toPeriod').isError) ? "input-error" : "" }`} 
    style={{ 
      flex: 2.2, 
      display: 'flex', 
      flexDirection: 'column', 
      borderRight: '1px solid black',
      padding: '4px' 
    }}
  >
    <label>Period of Report</label>
    
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: '15px' }}>
      
      {/* BLOCK 14: FROM */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
        <label style={{whiteSpace: 'nowrap' }}>14. From:</label>
        <input 
          type={isFromFocused ? "date" : "text"}
          className="navfit-input"
          style={{ width: 'auto', flex: 1, border: 'none', background: 'transparent' }} 
          value={isFromFocused ? convertNavyToRaw(formData.fromPeriod) : formData.fromPeriod}
          onChange={(e) => {
            const val = e.target.value;
            handleChange('fromPeriod', val ? formatDateToNavy(val) : "");
          }} 
          onFocus={() => setIsFromFocused(true)}
          onBlur={() => setIsFromFocused(false)}
        />
      </div>

      {/* BLOCK 15: TO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
        <label style={{whiteSpace: 'nowrap' }}>15. To:</label>
        <input 
          type={isToFocused ? "date" : "text"}
          className="navfit-input"
          style={{ width: 'auto', flex: 1, border: 'none', background: 'transparent' }}
          value={isToFocused ? convertNavyToRaw(formData.toPeriod) : formData.toPeriod}
          onChange={(e) => {
            const val = e.target.value;
            handleChange('toPeriod', val ? formatDateToNavy(val) : "");
          }} 
          onFocus={() => setIsToFocused(true)}
          onBlur={() => setIsToFocused(false)}
        />
      </div>
    </div>

    {/* SHARED ERROR NOTES AT THE BOTTOM */}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {getError('fromPeriod').isError && (
        <div className="error-note">{getError('fromPeriod').note}</div>
      )}
      {getError('toPeriod').isError && (
        <div className="error-note">{getError('toPeriod').note}</div>
      )}
    </div>
  </div> 
  </div>

  {/* BLOCKS 16-21 */}
  <div className="navfit-row">
   {/* BLOCK 16: NOT OBSERVED REPORT */}
    <div className="navfit-cell" style={{ 
      flex: 0.75, 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      minHeight: '45px',
      borderLeft: '1px solid black',
    }}>
      <label>16. Not Observed</label>
      
      {/* Container to push the button to the bottom right */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'flex-end',
        padding: '2px' 
      }}>
        <label className="radio-label" style={{ cursor: 'pointer', display: 'flex' }}>
          <input 
            type="radio"
            value="Not Observed Report"
            checked={formData.notObserved === 'Not Observed Report'}
            onChange={(e) => handleChange('notObserved', e.target.value)}
            onClick={() => { if (formData.notObserved === 'Not Observed Report') handleChange('notObserved', ''); }}
            style={{ margin: 0 }}
          />
        </label>
      </div>
    </div>
    
    {/* BLOCKS 17-19: TYPE OF REPORT */}
    <div className="navfit-cell" style={{ flex: 2.25, display: 'flex', flexDirection: 'column' }}>
      <label>Type of Report</label>
      <div className="radio-group" style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        flexWrap: 'nowrap', 
        justifyContent: 'flex-start', /* Pulls everything to the left */
        alignItems: 'center',
        marginTop: '4px',
        height: '100%',
        gap: '15px' /* Adjust this value to move the groups closer or further apart */
      }}>
        {/* 17. Regular */}
        <label className="radio-label" style={{whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <span>17. Regular</span>
          <input 
            type="radio"
            name="reportType"
            value="Regular"
            checked={formData.reportType === 'Regular'}
            onChange={(e) => handleChange('reportType', e.target.value)}
            onClick={() => { if (formData.reportType === 'Regular') handleChange('reportType', ''); }} 
          />
        </label>
        
        {/* 18. Concurrent */}
        <label className="radio-label" style={{whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <span>18. Concurrent</span>
          <input 
            type="radio"
            name="reportType"
            value="Concurrent"
            checked={formData.reportType === 'Concurrent'}
            onChange={(e) => handleChange('reportType', e.target.value)}
            onClick={() => { if (formData.reportType === 'Concurrent') handleChange('reportType', ''); }} 
          />
        </label>
        
        {/* 19. Ops Cdr */}
        <label className="radio-label" style={{whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <span>19. Ops Cdr</span>
          <input 
            type="radio"
            name="reportType"
            value="Ops Cdr"
            checked={formData.reportType === 'Ops Cdr'}
            onChange={(e) => handleChange('reportType', e.target.value)}
            onClick={() => { if (formData.reportType === 'Ops Cdr') handleChange('reportType', ''); }} 
          />
        </label>
      </div>
    </div>

      {/* BLOCK 20: PHYSICAL READINESS */}
      <div 
        className={`navfit-cell ${getError('physicalRead').isError ? "input-error" : ""}`} 
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <label>20. Physical Readiness</label>
        <input 
          className="navfit-input"
          type="text" 
          value={formData.physicalRead} 
          // Auto-uppercase and limit to 4 characters (standard for these codes)
          onChange={(e) => handleChange('physicalRead', e.target.value.toUpperCase())} 
        />

        {/* Validator note for Navy codes */}
        {getError('physicalRead').isError && (
          <div className="error-note">
            {getError('physicalRead').note}
          </div>
        )}
      </div>


        {/*BLOCK 21*/}
        <div className="navfit-cell" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>
          <label>21. Billet Subcategory (if any)</label>
          <select 
            value={formData.billetSub} 
            onChange={(e) => handleChange('billetSub', e.target.value)}
            className="dropdown-input"
          >
            <option value="">   </option>
            <option value="NA">NA</option>
            <option value="BASIC">BASIC</option>
            <option value="APPROVED">APPROVED</option>
            <option value="INDIV AUG">INDIV AUG</option>
            <option value="CO AFLOAT">CO AFLOAT</option>
            <option value="CO ASHORE">CO ASHORE</option>
            <option value="OIC">OIC</option>
            <option value="SEA COMP">SEA COMP</option>
            <option value="APPROVED">APPROVED</option>
            <option value="CRF">CRF</option>
            <option value="CANVASSER">CANVASSER</option>
            <option value="RESIDENT">RESIDENT</option>
            <option value="INTERN">INTERN</option>
            <option value="INSTRUCTOR">INSTRUCTOR</option>
            <option value="STUDENT">STUDENT</option>
            <option value="RESAC1">RESAC1</option>
            <option value="RESAC6">RESAC6</option>
            <option value="SPECIAL01">SPECIAL01</option>
            <option value="SPECIAL02">SPECIAL02</option>
            <option value="SPECIAL03">SPECIAL03</option>
            <option value="SPECIAL04">SPECIAL04</option>
            <option value="SPECIAL05">SPECIAL05</option>
            <option value="SPECIAL06">SPECIAL06</option>
            <option value="SPECIAL07">SPECIAL07</option>
            <option value="SPECIAL08">SPECIAL08</option>
            <option value="SPECIAL09">SPECIAL09</option>
            <option value="SPECIAL10">SPECIAL10</option>
            <option value="SPECIAL11">SPECIAL11</option>
            <option value="SPECIAL12">SPECIAL12</option>
            <option value="SPECIAL13">SPECIAL13</option>
            <option value="SPECIAL14">SPECIAL14</option>
            <option value="SPECIAL15">SPECIAL15</option>
            <option value="SPECIAL16">SPECIAL16</option>
            <option value="SPECIAL17">SPECIAL17</option>
            <option value="SPECIAL18">SPECIAL18</option>
            <option value="SPECIAL19">SPECIAL19</option>
            <option value="SPECIAL20">SPECIAL20</option>
          </select>
        </div>
      
      </div>

    {/* BLOCKS 22-27 */}
    <div className="navfit-row" style={{ 
      display: 'flex', 
      width: '100%', 
      alignItems: 'stretch',
      flexWrap: 'nowrap' 
    }}>
            
    {/* BLOCK 22: REPORTING SENIOR */}
    <div 
      className={`navfit-cell ${getError('reportSenior').isError ? "input-error" : ""}`} 
      style={{ flex: 2, minWidth: 0, borderLeft: '1px solid black' }}
    >
      <label>
        22. Reporting Senior (Last, First MI Suffix)
      </label>
      <input 
        type="text" 
        className="navfit-input" 
        value={formData.reportSenior} 
        // Auto-uppercase and sanitize to allow only letters, commas, and spaces
        onChange={(e) => {
          const cleanValue = e.target.value.toUpperCase().replace(/[^A-Z,\s]/g, '');
          handleChange('reportSenior', cleanValue);
        }} 
      />

      {/* Display the validation note (e.g., "Required Format: LAST, FIRST MI") */}
      {getError('reportSenior').isError && (
        <div className="error-note">
          {getError('reportSenior').note}
        </div>
      )}
    </div>

      {/* BLOCK 23: SENIOR GRADE */}
      <div 
        className={`navfit-cell ${getError('reportGrade').isError ? "input-error" : ""}`} 
        style={{ flex: 0.5, minWidth: 0 }}
      >
        <label>23. Grade</label>
        <input 
          type="text" 
          className="navfit-input" 
          value={formData.reportGrade} 
          // Auto-uppercase to match Navy standards
          onChange={(e) => handleChange('reportGrade', e.target.value.toUpperCase())} 
        />

        {/* Validator note for Senior Ranks */}
        {getError('reportGrade').isError && (
          <div className="error-note">
            {getError('reportGrade').note}
          </div>
        )}
      </div>

      {/* BLOCK 24: SENIOR DESIGNATOR */}
      <div 
        className={`navfit-cell ${getError('reportDesig').isError ? "input-error" : ""}`} 
        style={{ flex: 1 }}
      >
        <label>24. Desig</label>
        <input 
          className="navfit-input"
          value={formData.reportDesig} 
          // Removes any non-digits instantly, but allows unlimited length
          onChange={(e) => handleChange('reportDesig', e.target.value.replace(/\D/g, ''))} 
        />
        
        {/* Standard Error Display */}
        {getError('reportDesig').isError && (
          <div className="error-note">
            {getError('reportDesig').note}
          </div>
        )}
      </div>

      {/* BLOCK 25: SENIOR TITLE */}
      <div 
        className={`navfit-cell ${getError('reportTitle').isError ? "input-error" : ""}`} 
        style={{ flex: 1.5, minWidth: 0 }}
      >
        <label>25. Title</label>
        <input 
          type="text" 
          className="navfit-input" 
          value={formData.reportTitle} 
          // Auto-uppercase and reasonable character limit for the PDF box
          onChange={(e) => handleChange('reportTitle', e.target.value.toUpperCase().slice(0, 20))} 
        />

        {/* Validator note for character limits */}
        {getError('reportTitle').isError && (
          <div className="error-note">
            {getError('reportTitle').note}
          </div>
        )}
      </div>

      {/* BLOCK 26: SENIOR UIC */}
      <div 
        className={`navfit-cell ${getError('reportUIC').isError ? "input-error" : ""}`} 
        style={{ flex: 1 }}
      >
        <label>26. UIC</label>
        <input 
          className="navfit-input" // Ensure this matches your CSS for inputs
          value={formData.reportUIC} 
          onChange={(e) => handleChange('reportUIC', e.target.value.replace(/\D/g, ''))} 
        />
        
        {/* Standard Error Display */}
        {getError('reportUIC').isError && (
          <div className="error-note">
            {getError('reportUIC').note}
          </div>
        )}
      </div>

      {/* BLOCK 27: SENIOR SSN */}
      <div 
        className={`navfit-cell ${getError('reportSSN').isError ? "input-error" : ""}`} 
        style={{ flex: 1, borderRight: '1px solid black', minWidth: 0 }}
      >
        <label>27. SSN</label>
        <input 
          className="navfit-input"
          value={formData.reportSSN || ""} /* Added || "" to prevent controlled/uncontrolled warnings */
          onChange={(e) => {
            // 1. Filter the input
            let val = e.target.value.replace(/[^0-9-]/g, '');
            
            // 2. Cap the length
            if (val.length > 11) val = val.slice(0, 11);
            
            // 3. FIX: Use 'val', not 'masked'
            handleChange('reportSSN', val);
          }}
        />

        {/* Display the error message */}
        {getError('reportSSN').isError && (
          <span className="error-note">
            {getError('reportSSN').note}
          </span>
        )}
      </div>
      </div>

    {/* BLOCK 28: COMMAND EMPLOYMENT AND ACHIEVEMENTS */}
    <div 
      className={`navfit-row ${getError('cmdEmployAch').isError ? "input-error" : ""}`} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%', 
        borderLeft: '1px solid black',
        borderRight: '1px solid black',
        padding: '5px'
      }}
    >
      <label>28. Command Employment and Command Achievements</label>
      
      <textarea 
        value={formData.cmdEmployAch} 
        onChange={(e) => handleChange('cmdEmployAch', e.target.value)} 
        className="navfit-textarea" 
        style={{ 
          width: '100%', 
          border: 'none',
          outline: 'none',
          resize: 'none',
          backgroundColor: 'transparent',
          lineHeight: '1.2',
        }}
        rows="4"
      />
      
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px dashed #ccc',
        marginTop: '1px',
        paddingTop: '1px'
      }}>
        {/* Error Note */}
        <span className="error-note">
          {getError('cmdEmployAch').isError ? getError('cmdEmployAch').note : ""}
        </span>

        {/* Character counter */}
        <span style={{ color: getError('cmdEmployAch').isError ? 'red' : '#666' }}>
          {formData.cmdEmployAch.length} / {FITREP_CONFIG.MAX_ACHIEVEMENT_LENGTH}
        </span>
      </div>
    </div>

    {/* BLOCK 29: PRIMARY/COLLATERAL DUTIES */}
    <div className={`navfit-row ${getError('primaryDuty').isError ? "input-error" : ""}`} 
        style={{ 
            display: 'flex', 
            flexDirection: 'column',
            width: '100%', 
            borderLeft: '1px solid black',
            borderRight: '1px solid black', 
            padding: '5px',
            position: 'relative',
            minHeight: '120px' // Ensures the box doesn't collapse
          }}>
      <label style={{marginBottom: '5px' }}>
        29. Primary/Collateral/Watchstanding Duties (Enter Primary Duty Abbreviation in Box)
      </label>

      {/* Mini Abbreviation Box (Stays Absolute) */}
      <div style={{
        position: 'absolute',
        left: '10px',
        top: '25px', // Adjusted slightly down from the label
        border: `1px solid ${getError('primaryDuty').isError ? 'red' : 'black'}`,
        width: '200px',
        height: '25px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#fff',
        zIndex: 10
      }}>
        <input 
          type="text"
          maxLength="14"
          value={formData.primaryDuty} 
          onChange={(e) => handleChange('primaryDuty', e.target.value.toUpperCase())} 
          style={{ 
            width: '100%', 
            border: 'none', 
            textAlign: 'center', 
            outline: 'none'
          }}
        />
      </div>

      {/* TEXTAREA WRAPPER: This is the secret sauce */}
      <div style={{ paddingTop: '35px', width: '100%' }}>
        <textarea 
          value={formData.duties} 
          onChange={(e) => handleChange('duties', e.target.value)} 
          className="navfit-textarea" 
          style={{ 
            width: '100%', 
            border: 'none',
            outline: 'none',
            resize: 'none',
            backgroundColor: 'transparent',
            lineHeight: '1.2',
            minHeight: '80px'
          }}
          rows="5"
        />
      </div>

      {/* FOOTER */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px dashed #ccc',
        marginTop: '5px'
      }}>
        <span>
          {getError('primaryDuty').isError ? getError('primaryDuty').note : ""}
        </span>
        <span style={{ color: '#666' }}>
          {formData.duties.length} / {FITREP_CONFIG.MAX_ACHIEVEMENT_LENGTH}
        </span>
      </div>
    </div>

      {/* ROW: BLOCKS 30-32 (COUNSELING) */}
      <div className="navfit-row" style={{ display: 'flex', width: '100%' }}>
        <div className="navfit-cell" style={{ flex: 1.5, borderLeft: '1px solid black'}}>
          <label>For Mid-term Counseling Use (When completing FITREP, enter 30 and 31 from counseling worksheet, sign 32.)</label>
        </div>

        <div 
        className={`navfit-cell ${getError('dateCounseled').isError ? "input-error" : ""}`} 
        style={{ flex: 0.5, position: 'relative' }}
      >
        <label>30. Date Counseled</label>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          width: '100%', 
          background: 'white',
          position: 'relative',
          borderBottom: 'none' /* Handled by navfit-cell */
        }}>
          {/* 1. THE TYPEABLE INPUT */}
          <input 
            className="navfit-input"
            maxLength="8"
            value={formData.dateCounseled} 
            onChange={(e) => handleChange('dateCounseled', e.target.value.toUpperCase())}
            style={{ 
              flex: 1,
              background: 'transparent',
              border: 'none',
              zIndex: 2, /* Typing layer on top */
              paddingRight: '25px' /* Space for the arrow */
            }}
          />

          {/* 2. THE DROPDOWN TRIGGER (Invisible select on the right) */}
          <div style={{ 
            position: 'absolute', 
            right: 0, 
            width: '25px', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 3 /* Arrow/Select layer on top */
          }}>
            <select 
              tabIndex="-1"
              onChange={(e) => {
                if (e.target.value) handleChange('dateCounseled', e.target.value);
                e.target.value = ""; // Reset select so same option can be picked again
              }}
              style={{ 
                position: 'absolute',
                width: '100%',
                height: '100%',
                opacity: 0, /* Make it invisible but clickable */
                cursor: 'pointer'
              }}
            >
              <option value=""></option>
              <option value="NOT REQ">NOT REQ</option>
              <option value="NOT PERF">NOT PERF</option>
            </select>
            
            {/* 3. THE VISUAL ARROW (Matches Navy Form Style) */}
            <span style={{ 
              color: '#333', 
              pointerEvents: 'none',
              marginTop: '2px'
            }}>▼</span>
          </div>
        </div>

        {/* DYNAMIC ERROR MESSAGE */}
        {getError('dateCounseled').isError && (
          <div className="error-note">
            {getError('dateCounseled').note}
          </div>
        )}
      </div>
        {/* Block 31 */}
        <div 
          className={`navfit-cell ${getError('counselor').isError ? "input-error" : ""}`} 
          style={{ flex: 1 }}
        >
          <label>31. Counselor</label>
          <input 
            className="navfit-input"
            value={formData.counselor} 
            // Auto-uppercase to help the user match the regex
            onChange={(e) => handleChange('counselor', e.target.value.toUpperCase())}
          />

          {/* Display the error message */}
          {getError('counselor').isError && (
            <div className="error-note">
              {getError('counselor').note}
            </div>
          )}
      </div>

        <div className="navfit-cell" style={{ flex: 1, borderRight: '1px solid black' }}>
          <label>32. Signature of Individual Counseled</label>
          <div style={{ marginTop: '12px', height: '15px' }}></div>
        </div>
      </div>

    {/* PERFORMANCE TRAITS SECTION */}
    <div className="navfit-row" style={{ display: 'flex', width: '100%', borderLeft: '1px solid black', borderRight: '1px solid black' }}>
        <div className="navfit-cell" style={{ flex: 1.5 }}>
          <label>PERFORMANCE TRAITS: 1.0 - Below standards/not progressing or UNSAT in any one standard; 2.0 - Does not yet meet all 3.0 standards; 3.0 - Meets all 3.0 standards; 4.0 - Exceeds most 3.0 standards; 5.0 - Meets overall criteria and most of the specific standards for 5.0.</label>
        </div>
    </div>

    {/* PERFORMANCE TRAITS HEADER ROW */}
    <div className="navfit-row" style={{ 
      display: 'flex', 
      width: '100%', 
      alignItems: 'stretch',
      borderLeft: '1px solid black',
      borderRight: '1px solid black',
      borderBottom: '1px solid black',
      backgroundColor: '#f9f9f9'
    }}>
      {/* Matches PerformanceRow flex: 1.2 */}
      <div className="navfit-cell" style={{ flex: 1.2, minWidth: 0, justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderRight: '1px solid black' }}>
        <label>PERFORMANCE TRAITS</label>
      </div>
      
      {/* Each score header matches the row's flex (1.0, 0.6, 1.0, 0.6, 1.0) */}
      <div className="navfit-cell" style={{ flex: 1, minWidth: 0, borderRight: '1px solid black', textAlign: 'center' }}>
        <label>1.0*</label><label>BELOW</label>
      </div>
      
      <div className="navfit-cell" style={{ flex: 0.6, minWidth: 0, borderRight: '1px solid black', textAlign: 'center' }}>
        <label>2.0</label>
      </div>
      
      <div className="navfit-cell" style={{ flex: 1, minWidth: 0, borderRight: '1px solid black', textAlign: 'center' }}>
        <label>3.0</label><label>MEETS</label>
      </div>
      
      <div className="navfit-cell" style={{ flex: 0.6, minWidth: 0, borderRight: '1px solid black', textAlign: 'center' }}>
        <label>4.0</label>
      </div>
      
      <div className="navfit-cell" style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <label>5.0</label><label>EXCEEDS</label>
      </div>
    </div>

    <div className="performance-section" style={{borderLeft: '1px solid black', borderRight: '1px solid black'}}>
      
      {/* Block 33 */}
      <PerformanceRow 
        label="33. PROFESSIONAL EXPERTISE" 
        subLabel="Professional knowledge, proficiency, and qualifications."
        name="proExpert" 
        value={formData.proExpert} 
        setter={(val) => handleChange('proExpert', val)} 
        standards={TRAIT_STANDARDS.proExpert} 
      />

      {/* Block 34 */}
      <PerformanceRow 
        label="34. COMMAND OR ORGANIZATIONAL CLIMATE/EQUAL OPPORTUNITY:" 
        subLabel="Contributing to growth and development, human worth, community."
        name="cmeo" 
        value={formData.cmeo} 
        setter={(val) => handleChange('cmeo', val)} 
        standards={TRAIT_STANDARDS.cmeo} 
      />

      {/* Block 35 */}
      <PerformanceRow 
        label="35. MILITARY BEARING/CHARACTER:" 
        subLabel="Appearance, conduct, physical fitness, adherance to Navy Core Values."
        name="bearing" 
        value={formData.bearing} 
        setter={(val) => handleChange('bearing', val)} 
        standards={TRAIT_STANDARDS.bearing} 
      />

      {/* Block 36 */}
      <PerformanceRow 
        label="36. TEAMWORK:"
        subLabel="Contributions toward team building and team results." 
        name="teamwork" 
        value={formData.teamwork} 
        setter={(val) => handleChange('teamwork', val)} 
        standards={TRAIT_STANDARDS.teamwork} 
      />

      {/* Block 37 */}
      <PerformanceRow 
        label="37. MISSION ACCOMPLISHMENT AND INITIATIVE:"
        subLabel="Taking initiative, planning/prioritizing, achieving mission." 
        name="missAccomp" 
        value={formData.missAccomp} 
        setter={(val) => handleChange('missAccomp', val)} 
        standards={TRAIT_STANDARDS.missAccomp} 
      />

      {/* Block 38 */}
      <PerformanceRow 
        label="38. LEADERSHIP:"
        subLabel="Organizing, motivating and developing others to accomplish goals." 
        name="leadership" 
        value={formData.leadership} 
        setter={(val) => handleChange('leadership', val)} 
        standards={TRAIT_STANDARDS.leadership} 
      />

      {/* Block 39 */}
      <PerformanceRow 
        label="39. TACTICAL PERFORMANCE:"
        subLabel="(Warfare qualified officers only) Basic and tactical employment of weapons systems." 
        name="tactPerform" 
        value={formData.tactPerform} 
        setter={(val) => handleChange('tactPerform', val)} 
        standards={TRAIT_STANDARDS.tactPerform} 
      />
    </div>

      {/* BLOCK 40: MILESTONES */}
<div className="navfit-row" style={{ 
  display: 'flex', 
  borderLeft: '1px solid black', 
  borderRight: '1px solid black',
  borderBottom: '1px solid black' /* Added bottom border to close the box */
}}>
  {/* LEFT: Labels */}
  <div className="navfit-cell" style={{ flex: 3, display: 'flex', flexDirection: 'column' }}>
    <label>40. I recommend screening this individual for next career milestone(s) as follows: (maximum of two)</label>
    <label>Recommendations may be for competitive schools or duty assignments such as:</label>
    <label>SCP, Dept Head, XO, OIC, CO, Major Command, War College, PG School</label>
  </div>

  {/* MIDDLE: Milestone One Box */}
  <div 
    className={`navfit-cell ${getError('milestoneOne').isError ? "input-error" : ""}`} 
    style={{ 
      flex: 0.5, 
      borderLeft: '1px solid black', /* CRITICAL: This creates the first box in the PDF */
      display: 'flex',
      alignItems: 'center'
    }}
  >
    <input 
      className="navfit-input" 
      value={formData.milestoneOne} 
      onChange={(e) => handleChange('milestoneOne', e.target.value.toUpperCase())}
      style={{ textAlign: 'center' }} 
    />
  </div>

  {/* RIGHT: Milestone Two Box */}
  <div 
    className={`navfit-cell ${getError('milestoneTwo').isError ? "input-error" : ""}`} 
    style={{ 
      flex: 0.5, 
      borderLeft: '1px solid black', /* CRITICAL: This separates the two boxes in the PDF */
      display: 'flex',
      alignItems: 'center'
    }}
  >
    <input 
      className="navfit-input" 
      value={formData.milestoneTwo} 
      onChange={(e) => handleChange('milestoneTwo', e.target.value.toUpperCase())}
      style={{ textAlign: 'center' }}
    />
  </div>
</div>
   {/* BLOCK 41: COMMENTS */}
<div 
  className={`navfit-row ${getError('comments').isError ? "input-error" : ""}`} 
  style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    borderLeft: '1px solid black', 
    borderRight: '1px solid black', 
    padding: '5px',
    minHeight: '220px' 
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
    <label>
      41. COMMENTS ON PERFORMANCE: <span>* All 1.0 marks, three 2.0 marks, and 2.0 marks in Block 34 must be specifically substantiated</span>
    </label>
    
    {/* Font Size Selector */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '9px' }}>FONT:</span>
      <select 
        value={formData.commentFontSize || "10px"} 
        onChange={(e) => handleChange('commentFontSize', e.target.value)}
        style={{ padding: '0 2px', cursor: 'pointer' }}
      >
        <option value="10px">10 pt</option>
        <option value="12px">12 pt</option>
      </select>
    </div>
  </div>

  <textarea 
  value={formData.comments} 
  onChange={(e) => handleChange('comments', e.target.value)} 
  className="navfit-textarea block-41-textarea"
  style={{ 
    width: '100%', 
    flex: 1,
    minHeight: '180px', 
    fontSize: formData.commentFontSize || "10px", 
    /* CHANGED: Use 'px' or 'rem' so the line counter math is exact */
    lineHeight: '1.25rem', 
    resize: 'none',
    boxSizing: 'border-box', 
    overflow: 'hidden'
  }} 
/>

  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
    {/* Error Note Area */}
    <div className="error-note">
      {getError('comments').isError && getError('comments').note}
    </div>

    {/* Metadata Stats */}
    <div style={{ textAlign: 'right', opacity: 0.7 }}>
    <span style={{ marginRight: '10px', color: totalLines > 18 ? 'red' : 'inherit' }}>
      LINES: {totalLines} / 18
    </span>
    <span>CHARS: {formData.comments.length}</span>
  </div>
  </div>
</div>

{/* BLOCKS 42-44: PROMO GRID CONTAINER */}
<div style={{ display: 'flex', width: '100%'}}>
  
  {/* LEFT SIDE WRAPPER: This groups the Header, 42, and 43 together */}
  <div style={{ flex: 3, display: 'flex', flexDirection: 'column' }}>
    
    {/* 1. THE SHARED HEADER ROW */}
    <div className="navfit-row" style={{ 
      display: 'flex', 
      width: '100%', 
      alignItems: 'stretch', 
      backgroundColor: '#f9f9f9', 
      borderLeft: '1px solid black',
      borderBottom: '1px solid black'
    }}>
      <div style={{ flex: '0 0 20%', padding: '4px', display: 'flex', alignItems: 'center', borderRight: '1px solid black', minWidth: 0, overflow: 'hidden' }}>
        <label style={{ margin: 0, lineHeight: '1' }}>
          PROMOTION RECOMMENDATION
        </label>
      </div>

      {["NOB", "SIGNIFICANT PROBLEMS", "PROGRESSING", "PROMOTABLE", "MUST PROMOTE", "EARLY PROMOTE"].map((cat) => (
        <div key={cat} style={{ 
          flex: 1, 
          textAlign: 'center', 
          borderRight: '1px solid black', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0 
        }}>
          <label style={{ TextAlign: 'center', lineHeight: '1' }}>{cat}</label>
        </div>
      ))}
    </div>

    {/* 2. BLOCK 42 (Individual) */}
    <PromoRec 
      label="42." 
      subLabel="INDIVIDUAL" 
      name="promotion" 
      value={formData.promotion} 
      setter={(val) => handleChange('promotion', val)} 
    />

    {/* 3. BLOCK 43 (Summary) */}
    <SumPromo 
      label="43." 
      subLabel="SUMMARY" 
      name="sumPromo" 
      value={formData.sumPromo} 
      setter={(val) => handleChange('sumPromo', val)} 
    />
  </div> {/* END OF LEFT SIDE WRAPPER */}

  {/* RIGHT SIDE: Block 44 (Sits next to the left column) */}
  <div 
    className="navfit-cell" 
    style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      borderRight: '1px solid black', 
      borderBottom: '1px solid black',
      padding: 0 
    }}
  >
    <label style={{ padding: '4px' }}>
      44. REPORTING SENIOR ADDRESS
    </label>
    
    <textarea 
      className="navfit-textarea" 
      value={formData.seniorAddress || ""} 
      onChange={(e) => handleChange('seniorAddress', e.target.value.toUpperCase())} 
      style={{ 
        flex: 1, 
        border: 'none', 
        resize: 'none', 
        padding: '5px',
        width: '100%',
        background: 'transparent'
      }} 
    />
  </div>
</div> {/* END OF MAIN CONTAINER */}


{/* SIGNATURE SECTION: BLOCKS 45 - 46 */}
<div className="navfit-row" style={{ display: 'flex', border: '1px solid black', borderTop: 'none', minHeight: '80px' }}>
  
  {/* BLOCK 45: SIGNATURE OF MEMBER */}
    <div className="navfit-cell" style={{ 
      flex: 1,                /* Extended horizontally slightly */
      borderRight: '1px solid black', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '85px',        /* Extended vertically from 60px to 85px */
      position: 'relative',
      padding: '4px',
    }}>
      {/* TOP: Label */}
      <label style={{padding: '2px' }}>
        45. Signature of Member
      </label>

      {/* MIDDLE: Date Section */}
      <div style={{ 
        marginTop: 'auto',      
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        paddingBottom: '8px',   /* Added more space above the stats bar */
        paddingRight: '60px' 
      }}>
        <label>Date:</label>
      </div>

      {/* BOTTOM: Stats Row */}
      <div style={{ 
        display: 'flex', 
        borderTop: '1px solid black', 
        height: '22px',         /* Slightly taller for better alignment */
      }}>
        {/* Member Trait Average Box */}
        <div style={{ 
          flex: 1, 
          borderRight: '1px solid black', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 4px',
          whiteSpace: 'nowrap'  /* Prevents the text from jumping to two lines */
        }}>
          <span style={{marginRight: '4px' }}>Member Trait Average:</span>
          <input 
            style={{ border: 'none', width: '30px'}} 
            value={calculateTraitAverage()}
            readOnly 
          />
        </div>
        
        {/* Summary Group Average Box */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 4px',
          whiteSpace: 'nowrap'  /* Prevents the text from jumping to two lines */
        }}>
          <span style={{marginRight: '4px' }}>Summary Group Average:</span>
          <input
            style={{ border: 'none', width: '40px'}}
            value={raterGroupSummary?.summaryGroupAverage || 'NAN'}
            readOnly
          />
        </div>
      </div>
    </div>
  
  {/* BLOCK 46: SIGNATURE OF INDIVIDUAL EVALUATED */}
  <div className="navfit-cell" style={{ 
    flex: 1.2, 
    display: 'flex', 
    flexDirection: 'column',
    minHeight: '85px', 
    padding: '4px' 
  }}>
    {/* TOP: Labels */}
    <div style={{lineHeight: '1.1' }}>
      <label> 46. Signature of Individual Evaluated. "I have seen this report, been apprised of my</label>
      <label>performance, and understand my right to submit a statement."</label>
    </div>

    {/* Horizontal Radio Buttons */}
  <div style={{ 
    display: 'flex', 
    justifyContent: 'flex-start', // Starts on the left
    gap: '20px',                  // Increased gap for better spacing
    marginTop: '6px',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    paddingLeft: '5px'            // Small nudge away from the left border
  }}>
  
    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
      I intend to submit a statement.
      <input 
        type="radio"
        name="statementOption"
        value="submitted"
        checked={formData.statementOption === 'submitted'}
        onChange={(e) => handleChange('statementOption', e.target.value)}
        onClick={() => { if (formData.statementOption === 'submitted') handleChange('statementOption', ''); }}
        style={{ margin: 0 }}
      />
    </label>
    
    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
      I do not intend to submit a statement.
      <input 
        type="radio"
        name="statementOption"
        value="none"
        checked={formData.statementOption === 'none'}
        onChange={(e) => handleChange('statementOption', e.target.value)}
        onClick={() => { if (formData.statementOption === 'none') handleChange('statementOption', ''); }}
        style={{ margin: 0 }}
      />
    </label>
  </div>

    {/* BOTTOM RIGHT: Date Section */}
    <div style={{ 
      marginTop: 'auto',      
      display: 'flex', 
      justifyContent: 'flex-end', 
      alignItems: 'center',
      paddingBottom: '2px',
      paddingRight: '60px' 
    }}>
      <label>Date:</label>
    </div>
  </div>

  </div>
  {/* BLOCK 47: SIGNATURE OF REVIEWER */}
  <div className="navfit-cell" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid black', borderBottom: "1px solid black" }}>
    <label>47. Typed name, grade, command, UIC and signature of Regular Reporting Senior on Concurrent Report</label>
    <div style={{ 
      marginTop: 'auto',      
      display: 'flex', 
      justifyContent: 'flex-end', 
      alignItems: 'center',
      paddingBottom: '2px',
      paddingRight: '60px' 
    }}>
      <label>Date:</label>
    </div>
  </div>


      {/* ACTION BUTTONS */}
      <div className="navfit-actions" style={{ padding: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button className="save-btn" onClick={() => handleSaveFitrep(currentReportId, setCurrentReportId, dbPath)}>Save Changes</button>
        <button className="pdf-btn" onClick={handlePDFExport} disabled={!isSaved || hasUnsavedChanges}>Export PDF</button>
        <button className="accdb-btn" onClick={handleACCDBExport} disabled={!isSaved || hasUnsavedChanges}>Export ACCDB</button>
      </div>

      {/* MODAL OVERLAY */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ color: modalContent.isError ? 'red' : 'green' }}>{modalContent.title}</h3>
            <p>{modalContent.text}</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}

    </div> // This closes navfit-paper
  );
}
