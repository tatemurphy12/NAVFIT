import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HomePage.css';
import logo from './logo.png';

export default function HomePage() {
  const [databases, setDatabases] = useState([]);
  const [openedDb, setOpenedDb] = useState(null);
  const [fitreps, setFitreps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fitrepsLoading, setFitrepsLoading] = useState(false);
  const [ssnState, setSsnState] = useState('decrypted');
  const [hasPassword, setHasPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { loadDatabases(); }, []);

  // Auto-open a database if navigated back from FitrepForm
  useEffect(() => {
    if (location.state?.openDb) {
      handleEnterFolder(location.state.openDb);
    }
  }, [location.state]);

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const list = await window.api.getDatabases();
      setDatabases(list || []);
    } catch (err) {
      console.error('Failed to load databases:', err);
      setDatabases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const result = await window.api.createDatabase();
    if (result.success) {
      await loadDatabases();
    } else if (result.message) {
      alert("Error creating database: " + result.message);
    }
  };

  const handleOpenDatabase = async () => {
    const result = await window.api.uploadDatabase();
    if (result.success) {
        await loadDatabases();
    } else if (result.error) {
        alert("Error opening database: " + result.error);
    }
  };

  const handleEnterFolder = async (db) => {
    setFitrepsLoading(true);
    try {
      // Ask the backend to load the reports
      const rows = await window.api.loadFitreps(db.path);
      
      // If main.js returns an object with an error instead of an array, catch it
      if (rows.error) {
          alert(`Cannot find database at: ${db.path}\nIt may have been moved or deleted.`);
          setFitrepsLoading(false);
          return;
      }
      
      setOpenedDb(db);
      setFitreps(rows || []);
      // Load SSN encryption state for this database
      const stateResult = await window.api.getDbSsnState(db.path);
      setSsnState(stateResult.ssnState || 'decrypted');
      setHasPassword(!!stateResult.hasPassword);
    } catch (err) {
      console.error('Failed to load fitreps:', err);
      setFitreps([]);
    } finally {
      setFitrepsLoading(false);
    }
  };

  const handleBack = () => {
    setOpenedDb(null);
    setFitreps([]);
    setSsnState('decrypted');
    setHasPassword(false);
  };

  const handleRemoveDatabase = async (e, dbPath) => {
    e.stopPropagation(); // Crucial: Prevents the card click from opening the folder!
    const confirmed = window.confirm("Remove this database from the recent list?\n\n(The actual file will NOT be deleted from your computer).");
    if (confirmed) {
      await window.api.removeDatabase(dbPath);
      await loadDatabases(); // Refresh the grid
    }
  };

 // 1. Updated Edit Handler
  const handleEditReport = (report) => {
    // Navigate to the form and pass the full database row
    navigate('/fitrep', { 
      state: { 
        dbPath: openedDb.path, 
        reportId: report.ReportID, // Matches the 'rowid as ReportID' from main.js
        fitrep: report             // The full object containing all 53 columns
      } 
    });
  };

  // 2. Updated "Add New" Handler
  const handleAddNewReport = () => {
    navigate('/fitrep', { 
      state: { 
        dbPath: openedDb.path, 
        reportId: null, 
        fitrep: null 
      } 
    });
  };

  const handleDeleteFitrep = async (reportId) => {
    const confirmed = window.confirm('Are you sure you want to delete this report?');
    if (!confirmed) return;
    try {
      await window.api.deleteFitrep({ dbPath: openedDb.path, reportId });
      const rows = await window.api.loadFitreps(openedDb.path);
      setFitreps(rows || []);
    } catch (err) {
      console.error('Failed to delete fitrep:', err);
    }
  };

  // Force focus on password input when modal opens (autoFocus doesn't work in Electron)
  useEffect(() => {
    if (showPasswordModal && passwordRef.current) {
      setTimeout(() => passwordRef.current.focus(), 50);
    }
  }, [showPasswordModal]);

  const handleToggleSSNEncryption = () => {
    setPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const needsConfirm = ssnState === 'decrypted' && !hasPassword;

  const handlePasswordSubmit = async () => {
    if (!passwordInput) {
      setPasswordError('Password is required.');
      return;
    }
    if (needsConfirm) {
      // First time: require confirmation
      if (passwordInput !== confirmPasswordInput) {
        setPasswordError('Passwords do not match.');
        return;
      }
    }
    if (ssnState === 'decrypted') {
      // Encrypting
      const result = await window.api.encryptSSNs({ dbPath: openedDb.path, password: passwordInput });
      if (result.success) {
        setSsnState('encrypted');
        setHasPassword(true);
        setShowPasswordModal(false);
        alert(`SSNs encrypted successfully. ${result.recordsUpdated} report(s) updated.`);
        const rows = await window.api.loadFitreps(openedDb.path);
        if (!rows.error) setFitreps(rows || []);
      } else {
        setPasswordError('Encryption failed: ' + result.error);
      }
    } else {
      // Decrypting
      const result = await window.api.decryptSSNs({ dbPath: openedDb.path, password: passwordInput });
      if (result.success) {
        setSsnState('decrypted');
        setShowPasswordModal(false);
        alert(`SSNs decrypted successfully. ${result.recordsUpdated} report(s) updated.`);
        const rows = await window.api.loadFitreps(openedDb.path);
        if (!rows.error) setFitreps(rows || []);
      } else {
        setPasswordError(result.error || 'Decryption failed.');
      }
    }
  };

  const handleExportACCDB = async () => {
    try {
      const result = await window.api.exportACCDB(openedDb.path);
      if (result.success) {
        alert(`ACCDB exported successfully!\n\n${result.path}`);
      } else if (result.error && result.error !== "ACCDB Export cancelled.") {
        alert(`Export failed:\n${result.error}`);
      }
    } catch (err) {
      alert(`Export failed:\n${err.message || err}`);
    }
  };

  // ── OPENED DATABASE VIEW ─────────────────────────────────────────────────
  if (openedDb) {
    return (
      <div className="homepage">
        <img src={logo} alt="logo" className="logo" />
        <header className="homepage-header">
          <h1 className="homepage-title">NAVFIT<span className="title-accent">26</span></h1>
        </header>
        <div className="db-opened-view">
          <div className="db-opened-header">
            <button className="btn btn-ghost" onClick={handleBack}>← Back</button>
            <div className="db-badge">
              <span className="db-badge-icon">🗄️</span>
              <span className="db-badge-name">{openedDb.name}</span>
            </div>
          </div>

          <div className="db-actions">
            <button className="btn btn-primary" onClick={handleAddNewReport}>
              + Add Report
            </button>
            <button className="btn btn-secondary" onClick={handleExportACCDB}>
              ↓ Export ACCDB
            </button>
            <button className="btn btn-secondary" onClick={handleToggleSSNEncryption}>
              {ssnState === 'decrypted' ? 'Encrypt SSNs' : 'Decrypt SSNs'}
            </button>
          </div>

          <div className="fitreps-section">
            {fitrepsLoading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <p>Loading reports...</p>
              </div>
            ) : fitreps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <p>No reports yet. Click "+ Add Report" to create one.</p>
              </div>
            ) : (
              <table className="fitreps-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Rate / Grade</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fitreps.map((report) => (
                    <tr key={report.ReportID}>
                      <td>{report.ReportID}</td>
                      <td>{report.FullName || '—'}</td>
                      <td>{report.Rate || '—'}</td>
                      <td className="action-cell">
                        <button className="btn btn-secondary" onClick={() => handleEditReport(report)}>
                          ✏️ Edit / View
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteFitrep(report.ReportID)}>
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showPasswordModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{
              background: '#1e1e2e', borderRadius: '12px', padding: '30px',
              minWidth: '360px', maxWidth: '420px', color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
              <h3 style={{ margin: '0 0 8px 0' }}>
                {ssnState === 'decrypted' ? 'Encrypt SSNs' : 'Decrypt SSNs'}
              </h3>
              <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 20px 0' }}>
                {needsConfirm
                  ? 'Create a password to encrypt SSNs. You will need this password to decrypt them later.'
                  : 'Enter your password.'}
              </p>

              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>Password</label>
              <input
                ref={passwordRef}
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '6px',
                  border: '1px solid #444', background: '#2a2a3e', color: '#fff',
                  fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box'
                }}
              />

              {needsConfirm && (
                <>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '6px',
                      border: '1px solid #444', background: '#2a2a3e', color: '#fff',
                      fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box'
                    }}
                  />
                </>
              )}

              {passwordError && (
                <p style={{ color: '#ff6b6b', fontSize: '13px', margin: '0 0 12px 0' }}>{passwordError}</p>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handlePasswordSubmit}
                >
                  {ssnState === 'decrypted' ? 'Encrypt' : 'Decrypt'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── HOME / DATABASE GRID ─────────────────────────────────────────────────
  return (
    <div className="homepage">
      <img src={logo} alt="logo" className="logo" />
      <header className="homepage-header">
        <h1 className="homepage-title">NAVFIT<span className="title-accent">26</span></h1>
        <p className="homepage-subtitle">FITREP MANAGEMENT SYSTEM</p>
      </header>

      <div className="homepage-buttons">
        <button className="btn btn-primary" onClick={handleCreate}>+ New Database</button>
        <button className="btn btn-secondary" onClick={handleOpenDatabase}>📂 Open Database</button>
      </div>

      <div className="databases-section">
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⏳</div><p>Loading databases...</p></div>
        ) : databases.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🗄️</div><p>No databases yet. Create or open one to get started.</p></div>
        ) : (
          <>
            <p className="databases-hint">Click a database to open it</p>
            <div className="databases-grid">
              {databases.map((db, index) => (
                <div key={index} className="database-card" onClick={() => handleEnterFolder(db)} title={db.path}>
                  <button 
                    onClick={(e) => handleRemoveDatabase(e, db.path)}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                    onMouseOver={(e) => { e.target.style.color = 'red'; e.target.style.background = '#fee'; }}
                    onMouseOut={(e) => { e.target.style.color = '#999'; e.target.style.background = 'none'; }}
                    title="Remove from list"
                  >
                    ✖
                  </button>
                  <div className="database-icon">🗄️</div>
                  <div className="database-name">{db.name}</div>
                  <div className="card-hint">click to open</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

