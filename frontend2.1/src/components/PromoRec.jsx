import React from 'react';

// Standardized PromoRec
const PromoRec = ({ label, subLabel, name, value, setter }) => (
    <div className="navfit-row" style={{ display: 'flex', borderBottom: '1px solid black' }}>
      <div className="navfit-cell" style={{ flex: 0.2, padding: '4px' }}>
        <div style={{ fontWeight: 'normal', fontSize: '10px' }}>{label}</div>
        <div style={{ fontSize: '8px', color: '#444' }}>{subLabel}</div>
      </div>
      
      {/* All scores set to 0.2 to match header */}
      {["NOB", "Significant Problems", "Progressing", "Promotable", "Must Promote", "Early Promote"].map((val) => (
        <div key={val} className="navfit-cell" style={{ flex: 0.2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <input type="radio" name={name} value={val} checked={value === val} onChange={(e) => setter(e.target.value)} />
        </div>
      ))}
    </div>
  );
  
  export default PromoRec;