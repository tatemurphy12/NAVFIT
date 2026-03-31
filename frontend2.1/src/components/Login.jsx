import React, { useState, useEffect } from 'react';

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState('');

  // 1. Check if a password exists on this computer's memory
  useEffect(() => {
    const saved = localStorage.getItem('navfit_master_password');
    if (!saved) {
      setIsSettingUp(true);
    } else {
      setStoredPassword(saved);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isSettingUp) {
      // INITIAL SETUP: Save the password to this machine
      if (password.length < 4) {
        setError('PASSWORD MUST BE AT LEAST 4 CHARACTERS');
        return;
      }
      localStorage.setItem('navfit_master_password', password);
      setStoredPassword(password);
      setIsSettingUp(false);
      setPassword('');
      setError('PASSWORD SET SUCCESSFULLY. PLEASE LOG IN.');
    } else {
      // LOGIN: Compare against the machine's saved password
      if (password === storedPassword) {
        onLogin(true);
      } else {
        setError('ACCESS DENIED: INCORRECT PASSWORD');
        setPassword('');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="main-form-header">{isSettingUp ? 'INITIAL SETUP' : 'NAVFIT ACCESS'}</h1>
        <p style={{ fontSize: '10px', marginBottom: '20px', textAlign: 'center' }}>
          {isSettingUp 
            ? 'CREATE A MASTER PASSWORD FOR THIS COMPUTER' 
            : 'ENTER PASSWORD TO UNLOCK FORM'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            placeholder={isSettingUp ? "CREATE PASSWORD" : "ENTER PASSWORD"}
            autoFocus
          />

          {error && <div className="error-note" style={{ margin: '10px 0' }}>{error}</div>}

          <button type="submit" className="login-button">
            {isSettingUp ? 'SAVE PASSWORD' : 'AUTHORIZE'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;