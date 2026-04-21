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
  const [passwordModalKey, setPasswordModalKey] = useState(0);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [exportPending, setExportPending] = useState(false);
  const [ssnMessage, setSsnMessage] = useState(null);

  // General notification toast (replaces window.alert)
  const [notification, setNotification] = useState(null); // { message, type: 'success'|'error'|'info' }

  // Custom confirm modal (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '' });
  const confirmResolveRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmModal({ show: true, title, message });
    });
  };

  const handleConfirmYes = () => {
    confirmResolveRef.current?.(true);
    setConfirmModal({ show: false, title: '', message: '' });
  };

  const handleConfirmNo = () => {
    confirmResolveRef.current?.(false);
    setConfirmModal({ show: false, title: '', message: '' });
  };

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
      setNotification({ message: "Error creating database: " + result.message, type: 'error' });
    }
  };

  const handleOpenDatabase = async () => {
    const result = await window.api.uploadDatabase();
    if (result.success) {
        await loadDatabases();
    } else if (result.error) {
        setNotification({ message: "Error opening database: " + result.error, type: 'error' });
    }
  };

  const handleEnterFolder = async (db) => {
    setFitrepsLoading(true);
    try {
      // Ask the backend to load the reports
      const rows = await window.api.loadFitreps(db.path);
      
      // If main.js returns an object with an error instead of an array, catch it
      if (rows.error) {
          setNotification({ message: `Cannot find database at: ${db.path}. It may have been moved or deleted.`, type: 'error' });
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
    const confirmed = await showConfirm(
      "Remove Database",
      "Remove this database from the recent list?\n\n(The actual file will NOT be deleted from your computer)."
    );
    if (confirmed) {
      const result = await window.api.removeDatabase(dbPath);
      if (result.success) {
        await loadDatabases(); // Refresh the grid
      } else if (result.message) {
        setNotification({ message: result.message, type: 'error' });
      }
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
    const confirmed = await showConfirm("Delete Report", "Are you sure you want to delete this report?");
    if (!confirmed) return;
    try {
      await window.api.deleteFitrep({ dbPath: openedDb.path, reportId });
      const rows = await window.api.loadFitreps(openedDb.path);
      setFitreps(rows || []);
    } catch (err) {
      console.error('Failed to delete fitrep:', err);
    }
  };

  // Auto-dismiss SSN message after 3 seconds
  useEffect(() => {
    if (!ssnMessage) return;
    const timer = setTimeout(() => setSsnMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [ssnMessage]);

  // Auto-dismiss general notification (errors stay longer)
  useEffect(() => {
    if (!notification) return;
    const delay = notification.type === 'error' ? 6000 : 3000;
    const timer = setTimeout(() => setNotification(null), delay);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleToggleSSNEncryption = () => {
    setPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setPasswordModalKey(prev => prev + 1);
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
        setSsnMessage(`SSNs encrypted. ${result.recordsUpdated} report(s) updated.`);
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
        setSsnMessage(`SSNs decrypted. ${result.recordsUpdated} report(s) updated.`);
        const rows = await window.api.loadFitreps(openedDb.path);
        if (!rows.error) setFitreps(rows || []);
        // Auto-export if this decryption was triggered by Export ACCDB
        if (exportPending) {
          setExportPending(false);
          try {
            const exportResult = await window.api.exportACCDB(openedDb.path);
            if (exportResult.success) {
              setNotification({ message: `ACCDB exported successfully! ${exportResult.path}`, type: 'success' });
            } else if (exportResult.error && exportResult.error !== "ACCDB Export cancelled.") {
              setNotification({ message: `Export failed: ${exportResult.error}`, type: 'error' });
            }
          } catch (err) {
            setNotification({ message: `Export failed: ${err.message || err}`, type: 'error' });
          }
        }
      } else {
        setPasswordError(result.error || 'Decryption failed.');
      }
    }
  };

  const handleExportACCDB = async () => {
    if (ssnState === 'encrypted') {
      // Show password modal for decrypt-then-export flow
      setExportPending(true);
      setPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordError('');
      setPasswordModalKey(prev => prev + 1);
      setShowPasswordModal(true);
      return;
    }
    try {
      const result = await window.api.exportACCDB(openedDb.path);
      if (result.success) {
        setNotification({ message: `ACCDB exported successfully! ${result.path}`, type: 'success' });
      } else if (result.error && result.error !== "ACCDB Export cancelled.") {
        setNotification({ message: `Export failed: ${result.error}`, type: 'error' });
      }
    } catch (err) {
      setNotification({ message: `Export failed: ${err.message || err}`, type: 'error' });
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
                          Edit / View
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteFitrep(report.ReportID)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {ssnMessage && (
          <div style={{
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#1a6edd', color: '#fff', padding: '12px 24px',
            borderRadius: '8px', zIndex: 999, fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer'
          }} onClick={() => setSsnMessage(null)}>
            {ssnMessage}
          </div>
        )}

        {notification && (
          <div style={{
            position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
            background: notification.type === 'error' ? '#d9534f' : notification.type === 'success' ? '#28a745' : '#1a6edd',
            color: '#fff', padding: '12px 24px',
            borderRadius: '8px', zIndex: 999, fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
            maxWidth: '500px', textAlign: 'center'
          }} onClick={() => setNotification(null)}>
            {notification.message}
          </div>
        )}

        {confirmModal.show && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1002
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) handleConfirmNo(); }}
          >
            <div
              style={{
                background: '#1e1e2e', borderRadius: '12px', padding: '30px',
                minWidth: '340px', maxWidth: '420px', color: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 12px 0' }}>{confirmModal.title}</h3>
              <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 20px 0', whiteSpace: 'pre-line' }}>
                {confirmModal.message}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={handleConfirmNo}>Cancel</button>
                <button className="btn btn-danger" onClick={handleConfirmYes}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div
            key={passwordModalKey}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowPasswordModal(false); setExportPending(false); } }}
          >
            <div
              style={{
                background: '#1e1e2e', borderRadius: '12px', padding: '30px',
                minWidth: '360px', maxWidth: '420px', color: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 8px 0' }}>
                {exportPending ? 'Enter Password to Export' : ssnState === 'decrypted' ? 'Encrypt SSNs' : 'Decrypt SSNs'}
              </h3>
              <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 20px 0' }}>
                {exportPending
                  ? 'SSNs are encrypted. Enter your password to decrypt and export to ACCDB.'
                  : needsConfirm
                  ? 'Create a password to encrypt SSNs. You will need this password to decrypt them later.'
                  : 'Enter your password.'}
              </p>

              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>Password</label>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '6px',
                  border: '1px solid #444 !important', background: '#2a2a3e', color: '#fff',
                  fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box',
                  outline: 'none'
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
                      fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box',
                      outline: 'none'
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
                  onClick={() => { setShowPasswordModal(false); setExportPending(false); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handlePasswordSubmit}
                >
                  {exportPending ? 'Decrypt & Export' : ssnState === 'decrypted' ? 'Encrypt' : 'Decrypt'}
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
        <button className="btn btn-secondary" onClick={handleOpenDatabase}> Open Database</button>
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

      {notification && (
        <div style={{
          position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'error' ? '#d9534f' : notification.type === 'success' ? '#28a745' : '#1a6edd',
          color: '#fff', padding: '12px 24px',
          borderRadius: '8px', zIndex: 999, fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
          maxWidth: '500px', textAlign: 'center'
        }} onClick={() => setNotification(null)}>
          {notification.message}
        </div>
      )}

      {confirmModal.show && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1002
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleConfirmNo(); }}
        >
          <div
            style={{
              background: '#1e1e2e', borderRadius: '12px', padding: '30px',
              minWidth: '340px', maxWidth: '420px', color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0' }}>{confirmModal.title}</h3>
            <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 20px 0', whiteSpace: 'pre-line' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={handleConfirmNo}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmYes}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
