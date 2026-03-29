import React from 'react';

const PerformanceRow = ({ label, subLabel, name, value, setter, standards }) => (
  <div className="navfit-row" style={{ display: 'flex', borderBottom: '1px solid black' }}>
    
    {/* LEFT COLUMN: TRAIT & NOB */}
    <div className="navfit-cell" style={{ 
      flex: 1.2, 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '4px', 
      borderRight: '1px solid black',
      backgroundColor: '#fdfdfd' 
    }}>
      {/* Label and Sub-label inherit from App.css */}
      <label style={{ margin: 0, lineHeight: '1.1' }}>{label}</label>
      <span className="sub-label" style={{ fontSize: '0.9em', opacity: 0.8, display: 'block' }}>
        {subLabel}
      </span>
      
      <div style={{ 
        marginTop: 'auto', 
        alignSelf: 'flex-end', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px' 
      }}>
        <label style={{ fontWeight: 'normal', margin: 0 }}>NOB</label>
        <input 
          type="radio" 
          name={name} 
          value="NOB" 
          checked={value === 'NOB'} 
          onChange={(e) => setter(e.target.value)} 
        />
      </div>
    </div>

    {/* SCORE COLUMNS (1.0 - 5.0) */}
    {[
      { val: "1.0", flex: 1, text: standards?.s1 },
      { val: "2.0", flex: 0.6, text: "" },
      { val: "3.0", flex: 1, text: standards?.s3 },
      { val: "4.0", flex: 0.6, text: "" },
      { val: "5.0", flex: 1, text: standards?.s5 }
    ].map((col, idx) => (
      <div key={idx} className="navfit-cell" style={{ 
        flex: col.flex, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: idx % 2 !== 0 ? '#f9f9f9' : '#fff',
        minHeight: '100px'
      }}>
        {/* Standard Text: Uses Master Size via span */}
        <div style={{ width: '100%', flex: 1 }}>
          <span style={{ display: 'block', lineHeight: '1.1', fontWeight: 'normal' }}>
            {Array.isArray(col.text) 
              ? col.text.map((line, i) => <div key={i}>{line}</div>) 
              : col.text}
          </span>
        </div>
        
        {/* Radio Button Container */}
        <div style={{ marginTop: 'auto', alignSelf: 'flex-end', padding: '2px' }}>
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