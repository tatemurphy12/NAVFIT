import React from 'react';
const PerformanceRow = ({ label, subLabel, name, value, setter, standards }) => (
  <div className="navfit-row" style={{ display: 'flex', borderBottom: '1px solid black' }}>
    
    {/* LEFT COLUMN: TRAIT & NOB */}
    <div className="navfit-cell" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px', borderRight: '1px solid black' }}>
      {/* Force Trait Title to be small */}
      <div style={{fontSize: '9px', lineHeight: '1' }}>{label}</div>
      {/* Force Sub-description to be even smaller */}
      <div style={{ fontSize: '9px', color: '#444', marginTop: '2px', lineHeight: '1.1' }}>{subLabel}</div>
      
      <div style={{ 
        marginTop: 'auto', 
        alignSelf: 'flex-end', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '3px' 
      }}>
        <label style={{ fontWeight: 'normal', fontSize: '9px' }}>NOB</label>
        <input type="radio" name={name} value="NOB" checked={value === 'NOB'} onChange={(e) => setter(e.target.value)} />
      </div>
    </div>

    {/* SCORE COLUMNS (1.0 - 5.0) */}
    {[
      { val: "1.0", flex: 1, text: standards?.s1 },
      { val: "2.0", flex: 0.5, text: "" },
      { val: "3.0", flex: 1, text: standards?.s3 },
      { val: "4.0", flex: 0.5, text: "" },
      { val: "5.0", flex: 1, text: standards?.s5 }
    ].map((col, idx) => (
      <div key={idx} className="navfit-cell" style={{ 
        flex: col.flex, 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '2px',
        borderRight: idx === 4 ? 'none' : '1px solid black',
        backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9',
        minHeight: '80px'
      }}>
        {/* Standard Text: Controlled Font Size */}
        <div style={{ fontSize: '9px', lineHeight: '1.1', textAlign: 'left', width: '100%', flex: 1 }}>
          {Array.isArray(col.text) 
            ? col.text.map((line, i) => <div key={i}>{line}</div>) 
            : col.text}
        </div>
        
        <div style={{ marginTop: 'auto', alignSelf: 'flex-end' }}>
          <input 
            type="radio" 
            name={name} 
            value={col.val} 
            checked={value === col.val} 
            onChange={(e) => setter(e.target.value)} 
          />
        </div>
      </div>
    ))}
  </div>
);
export default PerformanceRow;