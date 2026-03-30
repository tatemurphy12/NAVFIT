import React from 'react';

const SumPromo = ({ label, subLabel, value, setter }) => {
    const handleInputChange = (field, val) => {
      const numericValue = val.replace(/[^0-9]/g, '');
      setter({ ...value, [field]: numericValue });
    };
  
    return (
      <div className="navfit-row" style={{ 
        display: 'flex', 
        borderBottom: '1px solid black',
        borderLeft: '1px solid black' 
      }}>
        
        {/* Label Column: Flex 1.5 */}
        <div className="navfit-cell" style={{ 
          flex: '0 0 20%',  
          padding: '4px', 
          borderRight: '1px solid black', 
          backgroundColor: '#f9f9f9' 
        }}>
          <label style={{ margin: 0, display: 'block' }}>{label}</label>
          <span style={{ display: 'block' }}>{subLabel}</span>
        </div>
  
        {['nob', 'sigProb', 'prog', 'promotable', 'mustPromote', 'earlyPromote'].map((field, idx) => {
          const isNob = field === 'nob';
          return (
            <div key={field} className="navfit-cell" style={{ 
              flex: 1, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: isNob ? '#000' : 'transparent',
              /* ALWAYS use borderRight to separate these from Block 44 */
              borderRight: '1px solid black' 
            }}>
              {!isNob ? (
                <input 
                  type="text" 
                  maxLength="3"
                  value={value[field] || ''} 
                  onChange={(e) => handleInputChange(field, e.target.value)} 
                  className="navfit-input"
                  style={{ 
                    textAlign: 'center', 
                    width: '100%', 
                    background: 'transparent', 
                    border: 'none',
                    outline: 'none'
                  }}
                  placeholder="0"
                />
              ) : (
                <div style={{ width: '100%', height: '100%' }} className="blackout-pattern" />
              )}
            </div>
          );
        })}
      </div>
    );
};
  
export default SumPromo;