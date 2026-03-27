import React from 'react';

/**Blocks 42 and 43 */

const SumPromo = ({ label, subLabel, value, setter }) => {
    const handleInputChange = (field, val) => {
      const numericValue = val.replace(/[^0-9]/g, '');
      setter({ ...value, [field]: numericValue });
    };
  
    return (
      <div className="navfit-row" style={{ display: 'flex', borderBottom: 'none' }}>
        <div className="navfit-cell" style={{ flex: 0.2, padding: '4px' }}>
          <div style={{ fontWeight: 'normal', fontSize: '10px' }}>{label}</div>
          <div style={{ fontSize: '8px', color: '#444' }}>{subLabel}</div>
        </div>
  
        {['nob', 'sigProb', 'prog', 'promotable', 'mustPromote', 'earlyPromote'].map((field) => {
          // Check if this is the NOB box
          const isNob = field === 'nob';
  
          return (
            <div key={field} className="navfit-cell" style={{ 
              flex: 0.2, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              /* If it's NOB, make it black, otherwise white */
              backgroundColor: isNob ? '#000' : '#fff' 
            }}>
              {!isNob && (
                <input 
                  type="text" 
                  maxLength="3"
                  value={value[field] || ''} 
                  onChange={(e) => handleInputChange(field, e.target.value)} 
                  className="navfit-input"
                  style={{ textAlign: 'center', fontWeight: 'normal', width: '100%' }}
                  placeholder="0"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  export default SumPromo;