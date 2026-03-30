import React from 'react';

const PromoRec = ({ label, subLabel, name, value, setter }) => {
  return (
    <div className="navfit-row" style={{ 
      display: 'flex', 
      borderBottom: '1px solid black',
      borderLeft: '1px solid black',
      width: '100%' 
    }}>
      {/* 1. LABEL COLUMN: Flex 1.5 to match Header and SumPromo */}
      <div className="navfit-cell" style={{ 
        flex: '0 0 20%', 
        padding: '4px', 
        borderRight: '1px solid black',
        display: 'flex'
      }}>
        <label style={{ margin: 0, display: 'block' }}>{label}</label>
        <span style={{ display: 'block', fontWeight: 'normal' }}>{subLabel}</span>
      </div>

      {/* 2. RADIO COLUMNS: Flex 1 to match Header and SumPromo */}
      {/* Note: The values here should match your header categories exactly for consistent spacing */}
      {["NOB", "SIGNIFICANT PROBLEMS", "PROGRESSING", "PROMOTABLE", "MUST PROMOTE", "EARLY PROMOTE"].map((val, idx) => (
        <div key={val} className="navfit-cell" style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          /* borderRight here creates the vertical grid lines */
          borderRight: '1px solid black' 
        }}>
          <input 
            type="radio" 
            name={name} 
            value={val} 
            checked={value === val} 
            onChange={(e) => setter(e.target.value)} 
          />
        </div>
      ))}
    </div>
  );
};

export default PromoRec;