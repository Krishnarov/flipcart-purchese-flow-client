import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, LayoutDashboard, Bot, Trash2, Settings as SettingsIcon, LogOut, Folder, Mail, CheckCircle2, XCircle, Zap, ArrowRight, Activity, Clock, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import Uploads from './Uploads';
import Trash from './Trash';
import JobDetails from './JobDetails';
import Settings from './Settings';
import { socket } from '../socket';

function Dashboard({ user, onLogout, activeTab }) {
  const [globalStats, setGlobalStats] = useState({ jobs: 0, total: 0, success: 0, failed: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [runningJobs, setRunningJobs] = useState(0);
  const [liveLog, setLiveLog] = useState(null);
  const [lastJobSummary, setLastJobSummary] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      // Fetch Global Stats
      const statsRes = await fetch('http://localhost:5000/api/purchases/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setGlobalStats({
          jobs: statsData.stats.jobs,
          total: statsData.stats.total,
          success: statsData.stats.success,
          failed: statsData.stats.failed
        });
        setRunningJobs(statsData.stats.runningJobs || 0);
      }

      // Fetch Recent Jobs
      const filesRes = await fetch('http://localhost:5000/api/purchases/files?page=1&limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const filesData = await filesRes.json();
      if (filesData.success) {
        setRecentJobs(filesData.data);
      }

      // Fetch Last Job Summary
      const summaryRes = await fetch('http://localhost:5000/api/purchases/last-job-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setLastJobSummary(summaryData.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();

    const handleJobUpdate = (data) => {
      fetchStats();
      // Clear live log when job is stopped or completed
      if (data && (data.status === 'stopped' || data.status === 'completed' || data.status === 'failed' || data.status === 'idle')) {
        setLiveLog(null);
      }
    };

    const handleLiveLog = (data) => {
      // Only show live log for active statuses; clear for terminal ones
      if (data && (data.status === 'success' || data.status === 'failed')) {
        // Show briefly then clear after 3 seconds
        setLiveLog(data);
        setTimeout(() => setLiveLog(null), 3000);
      } else {
        setLiveLog(data);
      }
    };

    const handleLiveLogClear = () => {
      setLiveLog(null);
    };

    socket.on('job-update', handleJobUpdate);
    socket.on('live-log', handleLiveLog);
    socket.on('live-log-clear', handleLiveLogClear);
    return () => {
      socket.off('job-update', handleJobUpdate);
      socket.off('live-log', handleLiveLog);
      socket.off('live-log-clear', handleLiveLogClear);
    };
  }, [activeTab]);

  return (
    <div className={`dashboard-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="logo-icon"><ShoppingCart size={24} color="var(--accent-primary)" /></span>
            <h2 className="sidebar-title">Purchase Flow</h2>
          </div>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <span className="nav-icon"><LayoutDashboard size={18} /></span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'uploads' ? 'active' : ''}`}
            onClick={() => navigate('/uploads')}
          >
            <span className="nav-icon"><Bot size={18} /></span>
            <span className="nav-label">Automation</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'trash' ? 'active' : ''}`}
            onClick={() => navigate('/trash')}
          >
            <span className="nav-icon"><Trash2 size={18} /></span>
            <span className="nav-label">Trash</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <span className="nav-icon"><SettingsIcon size={18} /></span>
            <span className="nav-label">Settings</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="logout-btn" onClick={onLogout}>
            <span className="nav-icon"><LogOut size={18} /></span>
            <span className="nav-label">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="content-header">
          <div className="header-title">
            <h1>
              {activeTab === 'overview' ? 'Dashboard'
                : activeTab === 'trash' ? 'Trash'
                  : activeTab === 'job' ? 'Job Details'
                    : activeTab === 'settings' ? 'Settings'
                      : 'Purchase Automation'}
            </h1>
            <p>Welcome back, {user.email}</p>
          </div>
          <div className="user-profile">
            <div className="avatar">{user.email[0].toUpperCase()}</div>
            <span className="user-email">{user.email}</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="content-body">
          {activeTab === 'overview' ? (
            <div className="overview-container">
              {/* ── Live Stats Row ── */}
              <div className="live-stats-row" style={{ marginBottom: '24px' }}>
                <div className="live-stat-card" style={{ '--stat-gradient': 'linear-gradient(135deg, #6d28d9, #8b5cf6)', '--stat-glow': 'rgba(139,92,246,0.4)' }}>
                  <span className="live-stat-icon"><Folder size={24} /></span>
                  <div className="live-stat-info">
                    <span className="live-stat-value">{globalStats.jobs}</span>
                    <span className="live-stat-label">Total Jobs</span>
                  </div>
                </div>
                <div className="live-stat-card" style={{ '--stat-gradient': 'linear-gradient(135deg, #1d4ed8, #3b82f6)', '--stat-glow': 'rgba(59,130,246,0.4)' }}>
                  <span className="live-stat-icon"><Mail size={24} /></span>
                  <div className="live-stat-info">
                    <span className="live-stat-value">{globalStats.total.toLocaleString()}</span>
                    <span className="live-stat-label">Total Records</span>
                  </div>
                </div>
                <div className="live-stat-card" style={{ '--stat-gradient': 'linear-gradient(135deg, #065f46, #10b981)', '--stat-glow': 'rgba(16,185,129,0.4)' }}>
                  <span className="live-stat-icon"><CheckCircle2 size={24} /></span>
                  <div className="live-stat-info">
                    <span className="live-stat-value" style={{ color: '#34d399' }}>{globalStats.success.toLocaleString()}</span>
                    <span className="live-stat-label">Successful</span>
                  </div>
                </div>
                <div className="live-stat-card" style={{ '--stat-gradient': 'linear-gradient(135deg, #7f1d1d, #ef4444)', '--stat-glow': 'rgba(239,68,68,0.4)' }}>
                  <span className="live-stat-icon">{runningJobs > 0 ? <Zap size={24} /> : <XCircle size={24} />}</span>
                  <div className="live-stat-info">
                    <span className="live-stat-value" style={{ color: runningJobs > 0 ? '#60a5fa' : '#f87171' }}>
                      {runningJobs > 0 ? runningJobs : globalStats.failed.toLocaleString()}
                    </span>
                    <span className="live-stat-label">{runningJobs > 0 ? 'Running Now' : 'Failed'}</span>
                  </div>
                </div>
              </div>

              {/* ── Live Automation Activity ── */}
              {liveLog && (
                <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'linear-gradient(145deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)', border: '1px solid rgba(59,130,246,0.3)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Activity size={20} color="#60a5fa" />
                      <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '16px' }}>Live Automation Activity</h3>
                    </div>
                    <span className="status-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px', borderColor: '#60a5fa', borderTopColor: 'transparent' }} />
                      RUNNING
                    </span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Mail size={16} color="var(--text-muted)" />
                      <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{liveLog.email}</strong>
                      {liveLog.name && <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>— {liveLog.name}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '24px' }}>
                      <ArrowRight size={16} color="#60a5fa" style={{ marginTop: '2px' }} />
                      <span style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>
                        {liveLog.message}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="button" className="text-btn" onClick={() => navigate(`/job/${liveLog.jobId}`)} style={{ fontSize: '13px', color: '#60a5fa' }}>
                      View Job Details →
                    </button>
                  </div>
                </div>
              )}

              <div className="dashboard-content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>

                {/* ── Last Job Summary ── */}
                <div className="card" style={{ margin: 0, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Clock size={20} color="#f59e0b" />
                    <h3 style={{ margin: 0 }}>Last Job Summary</h3>
                  </div>

                  {!lastJobSummary ? (
                    <div className="empty-state" style={{ padding: '24px 0' }}>
                      <p style={{ color: 'var(--text-muted)' }}>No jobs found yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Job info */}
                      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lastJobSummary.jobName}
                          </span>
                          <span className={`status-badge status-${lastJobSummary.jobStatus}`}>{lastJobSummary.jobStatus}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                          {new Date(lastJobSummary.jobCreatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {/* Counts row */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <Mail size={12} color="#60a5fa" />
                            <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600 }}>{lastJobSummary.totalRecords} Total</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <CheckCircle2 size={12} color="#34d399" />
                            <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>{lastJobSummary.successCount} Success</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <XCircle size={12} color="#f87171" />
                            <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>{lastJobSummary.failedCount} Failed</span>
                          </div>
                          {lastJobSummary.pendingCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                              <Clock size={12} color="#fbbf24" />
                              <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>{lastJobSummary.pendingCount} Pending</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Last processed record */}
                      {lastJobSummary.lastRecord && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 600 }}>
                            Last Processed Task
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Mail size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>{lastJobSummary.lastRecord.email}</span>
                            {lastJobSummary.lastRecord.name && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>— {lastJobSummary.lastRecord.name}</span>
                            )}
                            <span className={`status-badge status-${lastJobSummary.lastRecord.status}`} style={{ fontSize: '10px', padding: '2px 8px', marginLeft: 'auto' }}>
                              {lastJobSummary.lastRecord.status}
                            </span>
                          </div>
                          {lastJobSummary.lastRecord.reason && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', paddingLeft: '22px', marginBottom: '4px' }}>
                              <ArrowRight size={12} color="#60a5fa" style={{ marginTop: '3px', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.4', wordBreak: 'break-word' }}>
                                {lastJobSummary.lastRecord.reason}
                              </span>
                            </div>
                          )}
                          {lastJobSummary.lastRecord.orderId && (
                            <div style={{ paddingLeft: '22px', fontSize: '12px', color: '#34d399' }}>
                              Order ID: {lastJobSummary.lastRecord.orderId}
                            </div>
                          )}
                        </div>
                      )}

                      <button type="button" className="text-btn" onClick={() => navigate(`/job/${lastJobSummary.jobId}`)} style={{ fontSize: '13px', color: '#60a5fa', alignSelf: 'flex-end' }}>
                        View Job Details →
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Quick Actions ── */}
                <div className="card" style={{ margin: 0, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Zap size={20} color="#f59e0b" />
                    <h3 style={{ margin: 0 }}>Quick Actions</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      className="quick-action-btn"
                      onClick={() => navigate('/uploads')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div style={{ padding: '10px', background: 'rgba(139,92,246,0.1)', borderRadius: '10px', color: '#8b5cf6' }}>
                        <Bot size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', color: 'var(--text-primary)' }}>New Automation</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload Excel to start</div>
                      </div>
                    </button>

                    <button
                      className="quick-action-btn"
                      onClick={() => navigate('/trash')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', color: '#ef4444' }}>
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', color: 'var(--text-primary)' }}>View Trash</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Restore or delete jobs</div>
                      </div>
                    </button>

                    <button
                      className="quick-action-btn"
                      onClick={() => navigate('/settings')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', color: 'var(--text-muted)' }}>
                        <SettingsIcon size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', color: 'var(--text-primary)' }}>Settings</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Change UI themes</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Recent Activity Table (full width below) ── */}
              <div className="card" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={20} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0 }}>Recent Activity</h3>
                  </div>
                  <button type="button" className="text-btn" onClick={() => navigate('/uploads')} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View All <ArrowRight size={14} />
                  </button>
                </div>

                {recentJobs.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No recent jobs found.</p>
                  </div>
                ) : (
                  <div style={{ margin: '0 -24px -24px -24px', borderRadius: '0 0 12px 12px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '14%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Job Name</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✓ Success</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✕ Failed</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentJobs.map(job => (
                          <tr
                            key={job._id}
                            onClick={() => navigate(`/job/${job._id}`)}
                            style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {job.uploadedFile}
                              </span>
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span className={`status-badge status-${job.status}`} style={{ fontSize: '11px' }}>{job.status}</span>
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: '#e2e8f0' }}>
                              {job.totalRecords || 0}
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: '#34d399' }}>
                              {job.successCount || 0}
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: '#f87171' }}>
                              {job.failedCount || 0}
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '13px' }}>
                              {new Date(job.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'trash' ? (
            <Trash />
          ) : activeTab === 'job' ? (
            <JobDetails />
          ) : activeTab === 'settings' ? (
            <Settings />
          ) : (
            <Uploads onUploadSuccess={fetchStats} />
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
