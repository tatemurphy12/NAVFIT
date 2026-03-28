import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const [databases, setDatabases] = useState([]);
  const [openedDb, setOpenedDb] = useState(null);
  const [fitreps, setFitreps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fitrepsLoading, setFitrepsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadDatabases(); }, []);

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

  // ── OPENED DATABASE VIEW ─────────────────────────────────────────────────
  if (openedDb) {
    return (
      <div className="homepage">
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
            <button className="btn btn-secondary" onClick={() => window.api.openExternal(openedDb.path)}>
              🗄️ Open in DB Browser
            </button>
            <button className="btn btn-secondary" onClick={() => window.api.exportDb(openedDb.path)}>
              ↓ Export SQLite
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
                        <button className="btn btn-secondary" onClick={() => handleEditReport(report.ReportID)}>
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
      </div>
    );
  }

  // ── HOME / DATABASE GRID ─────────────────────────────────────────────────
  return (
    <div className="homepage">
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