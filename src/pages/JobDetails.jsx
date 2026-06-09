import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Image as ImageIcon, RotateCcw, XCircle, Play, Square, Monitor } from 'lucide-react';
import DataTable from '../components/DataTable';
import ConfirmModal from '../components/ConfirmModal';
import { socket } from '../socket';

let toastId = 0;
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function JobDetails() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();

  const [selectedFileDetails, setSelectedFileDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [reasonFilter, setReasonFilter] = useState('all');
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Server-side state
  const [tableParams, setTableParams] = useState({ page: 1, limit: 50, search: '', sortField: 'createdAt', sortOrder: 'desc', startDate: '', endDate: '' });
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [liveLog, setLiveLog] = useState(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null
  });

  const addToast = useCallback((message, type = 'success') => {
    const toastIdNum = ++toastId;
    setToasts(prev => [...prev, { id: toastIdNum, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastIdNum));
    }, 4500);
  }, []);

  const fetchDetails = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const params = new URLSearchParams({
        jobId,
        page: tableParams.page,
        limit: tableParams.limit,
        search: tableParams.search,
        sortField: tableParams.sortField,
        sortOrder: tableParams.sortOrder,
        startDate: tableParams.startDate,
        endDate: tableParams.endDate
      });

      const res = await fetch(`http://localhost:5000/api/purchases/file-details?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedFileDetails({
          jobId,
          fileName: data.fileName,
          records: data.data,
          successPercentage: data.successPercentage,
          failedPercentage: data.failedPercentage,
          successCount: data.successCount,
          failedCount: data.failedCount,
          pendingCount: data.pendingCount,
          globalTotal: data.globalTotal,
          jobStatus: data.jobStatus,
          jobReason: data.jobReason,
          jobCompletedAt: data.jobCompletedAt
        });
        setTotalRecords(data.totalRecords);
        setTotalPages(data.totalPages);
      }
    } catch (fetchErr) {
      console.error('Error fetching details:', fetchErr);
      addToast('Error fetching job details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  }, [jobId, tableParams, addToast]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  useEffect(() => {
    const handleJobUpdate = (data) => {
      if (data.jobId === jobId) {
        fetchDetails();
      }
    };
    const handleLiveLog = (data) => {
      if (data.jobId === jobId) {
        setLiveLog(data);
      }
    };
    const handleLiveLogClear = (data) => {
      if (data.jobId === jobId) {
        setLiveLog(null);
      }
    };
    socket.on('job-update', handleJobUpdate);
    socket.on('live-log', handleLiveLog);
    socket.on('live-log-clear', handleLiveLogClear);
    return () => {
      socket.off('job-update', handleJobUpdate);
      socket.off('live-log', handleLiveLog);
      socket.off('live-log-clear', handleLiveLogClear);
    };
  }, [jobId, fetchDetails]);

  const handleTableChange = (params) => {
    setTableParams(params);
  };

  const handleExport = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;
    const params = new URLSearchParams({
      type: 'details',
      jobId,
      search: tableParams.search,
      startDate: tableParams.startDate,
      endDate: tableParams.endDate
    });

    try {
      const res = await fetch(`http://localhost:5000/api/purchases/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JobDetails_${jobId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      addToast('Failed to export Excel', 'error');
    }
  };

  const handleStartAutomation = async () => {
    setAutomationLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/purchases/start-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId, headless: !showBrowser })
      });
      const data = await res.json();
      addToast(data.message, data.success ? 'success' : 'error');
    } catch (_) {
      addToast('Failed to start automation', 'error');
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleStopAutomation = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Stop Automation',
      message: 'Are you sure you want to stop this running job? Any currently processing record might fail or remain pending.',
      action: async () => {
        setAutomationLoading(true);
        try {
          const token = sessionStorage.getItem('token');
          const res = await fetch('http://localhost:5000/api/purchases/stop-automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ jobId })
          });
          const data = await res.json();
          addToast(data.message, data.success ? 'success' : 'error');
        } catch (_) {
          addToast('Failed to stop automation', 'error');
        } finally {
          setAutomationLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRetryAutomation = async () => {
    setAutomationLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/purchases/retry-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId, reasonFilter, headless: !showBrowser })
      });
      const data = await res.json();
      addToast(data.message, data.success ? 'success' : 'error');
    } catch (_) {
      addToast('Failed to retry automation', 'error');
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleRetrySingle = async (recordId) => {
    setAutomationLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/purchases/retry-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recordId, headless: !showBrowser })
      });
      const data = await res.json();
      addToast(data.message, data.success ? 'success' : 'error');
    } catch (_) {
      addToast('Failed to retry record', 'error');
    } finally {
      setAutomationLoading(false);
    }
  };

  if (detailsLoading) {
    return (
      <div className="purchase-container">
        <div className="loading-state" style={{ padding: '64px 0' }}>
          <span className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
          <p>Loading details...</p>
        </div>
      </div>
    );
  }

  if (!selectedFileDetails) {
    return (
      <div className="purchase-container">
        <div className="empty-state" style={{ padding: '64px 0' }}>
          <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}><AlertTriangle size={56} /></div>
          <div className="empty-state-title">Job Not Found</div>
          <div className="empty-state-desc">The requested job details could not be found or were deleted.</div>
          <button type="button" className="detail-back-btn" onClick={() => navigate('/uploads')} style={{ marginTop: '16px' }}>
            ← Back to Automation
          </button>
        </div>
      </div>
    );
  }

  const isFileActive = ['pending', 'running'].includes(selectedFileDetails.jobStatus);
  const hasFailed = selectedFileDetails.records.some(r => r.status === 'failed');
  const uniqueReasons = [...new Set(selectedFileDetails.records.filter(r => r.status === 'failed').map(r => r.reason).filter(Boolean))];

  const columns = [
    {
      label: '#',
      key: 'index',
      width: '52px',
      sortable: false,
      render: (row, key, idx) => <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{(tableParams.page - 1) * tableParams.limit + idx + 1}</span>
    },
    {
      label: 'Email',
      key: 'email',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>{row.email}</span>
    },
    {
      label: 'Name',
      key: 'name',
      render: (row) => <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.name || '—'}</span>
    },
    {
      label: 'Product Link',
      key: 'productlink',
      render: (row) => (
        <span style={{ fontSize: '12px', color: '#60a5fa', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.productlink}>
          {row.productlink ? <a href={row.productlink} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{row.productlink}</a> : '—'}
        </span>
      )
    },
    {
      label: 'Phone',
      key: 'phone',
      render: (row) => <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.phone || '—'}</span>
    },
    {
      label: 'Status',
      key: 'status',
      render: (r) => (
        <span className={`status-badge status-${r.status}`} style={r.status === 'inprogress' ? { background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' } : {}}>
          {r.status === 'inprogress' && <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px', marginRight: '6px' }} />}
          {r.status === 'inprogress' ? 'IN PROGRESS' : r.status.toUpperCase()}
        </span>
      )
    },
    {
      label: 'Completed At',
      key: 'completedAt',
      render: (row) => row.completedAt ? (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {new Date(row.completedAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      ) : '—'
    },
    {
      label: 'Actions',
      key: 'actions',
      sortable: false,
      render: (row) => {
        const hasActions = row.screenshot || row.status === 'failed';
        if (!hasActions) return '—';

        return (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {row.screenshot && (
              <div className="screenshot-hover-wrapper">
                <button
                  type="button"
                  className="screenshot-link"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', padding: '6px', borderRadius: '4px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedScreenshot(row.screenshot);
                  }}
                  title="View Screenshot"
                >
                  <ImageIcon size={16} />
                </button>
                <div className="screenshot-popup-preview">
                  <img src={`http://localhost:5000/${row.screenshot}`} alt="preview" style={{ maxWidth: '200px', maxHeight: '150px', display: 'block', borderRadius: '4px', objectFit: 'contain' }} />
                </div>
              </div>
            )}
            {row.status === 'failed' && (
              <button
                type="button"
                className="inline-retry-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                onClick={(e) => { e.stopPropagation(); handleRetrySingle(row._id); }}
                disabled={isFileActive || automationLoading}
                title="Retry this record"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        );
      }
    },
    {
      label: 'Log / Reason',
      key: 'reason',
      render: (row) => (
        <div className="custom-tooltip-wrapper">
          <span
            style={{
              display: 'inline-block',
              fontSize: '12px',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: row.status === 'failed' ? '#fca5a5' : 'var(--text-muted)'
            }}
          >
            {row.reason || '—'}
          </span>
          {row.reason && (
            <div className="custom-tooltip">{row.reason}</div>
          )}
        </div>
      )
    }
  ];

  const processedData = selectedFileDetails.records.map(row => ({
    ...row,
    rowClass: row.status === 'running' ? 'row-running' : ''
  }));

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="purchase-container">
        <div className="card preview-card">
          <button type="button" className="detail-back-btn" onClick={() => navigate('/uploads')}>
            ← Back to Automation
          </button>

          <div className="detail-header-row">
            <div>
              <div className="detail-title">
                <span style={{ wordBreak: 'break-all' }}>{selectedFileDetails.fileName}</span>
                <span className={`status-badge status-${selectedFileDetails.jobStatus}`}>
                  {selectedFileDetails.jobStatus}
                </span>
              </div>
              <p className="detail-subtitle">
                {selectedFileDetails.globalTotal} records • {selectedFileDetails.successCount} succeeded • {selectedFileDetails.failedCount} failed • {selectedFileDetails.pendingCount} pending
                {selectedFileDetails.jobCompletedAt && (
                  <span> • Completed: {new Date(selectedFileDetails.jobCompletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </p>
              {selectedFileDetails.jobReason && (
                <div className="detail-log">
                  <span className="detail-log-dot" />
                  {selectedFileDetails.jobReason}
                </div>
              )}
              {liveLog && (
                <div className="detail-log" style={{ marginTop: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
                    <strong style={{ color: '#60a5fa', fontSize: '13px' }}>Currently Processing: {liveLog.email}</strong>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '20px' }}>
                    Step: <span style={{ color: '#e2e8f0' }}>{liveLog.message}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="detail-stats-box">
              <div className="detail-stat-row">
                <span className="detail-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> Success</span>
                <span className="detail-stat-value" style={{ color: '#34d399' }}>{selectedFileDetails.successPercentage}% ({selectedFileDetails.successCount})</span>
              </div>
              <div className="detail-progress-bar-wrap">
                <div className="detail-prog-success" style={{ width: `${selectedFileDetails.successPercentage}%` }} />
                <div className="detail-prog-failed" style={{ width: `${selectedFileDetails.failedPercentage}%` }} />
              </div>
              <div className="detail-stat-row">
                <span className="detail-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> Failed</span>
                <span className="detail-stat-value" style={{ color: '#f87171' }}>{selectedFileDetails.failedPercentage}% ({selectedFileDetails.failedCount})</span>
              </div>
              <div className="detail-stat-row" style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="detail-stat-label">Total</span>
                <span className="detail-stat-value">{selectedFileDetails.globalTotal}</span>
              </div>
            </div>
          </div>

          <div className="details-control-bar">
            <div className="action-buttons-group">
              <button
                type="button"
                className="ctrl-btn-start"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleStartAutomation}
                disabled={isFileActive || automationLoading}
              >
                {automationLoading ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <Play size={14} fill="currentColor" />}
                Start
              </button>
              <button
                type="button"
                className="ctrl-btn-stop"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleStopAutomation}
                disabled={!isFileActive || automationLoading}
              >
                <Square size={14} fill="currentColor" /> Stop
              </button>
            </div>

            <div className="retry-group">
              <label htmlFor="reason-filter">Retry Filter:</label>
              <select
                id="reason-filter"
                className="filter-select"
                value={reasonFilter}
                onChange={e => setReasonFilter(e.target.value)}
                disabled={!hasFailed || isFileActive || automationLoading}
              >
                <option value="all">All Failed ({selectedFileDetails.failedCount})</option>
                {uniqueReasons.map((reason, idx) => {
                  const cnt = selectedFileDetails.records.filter(e => e.reason === reason).length;
                  return (
                    <option key={idx} value={reason}>
                      {reason.length > 32 ? `${reason.substring(0, 32)}…` : reason} ({cnt})
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className="ctrl-btn-retry"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleRetryAutomation}
                disabled={!hasFailed || isFileActive || automationLoading}
              >
                <RotateCcw size={14} /> Retry Failed
              </button>

              <label className="toggle-wrap" title="Show browser window during automation">
                <span className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showBrowser}
                    onChange={e => setShowBrowser(e.target.checked)}
                    disabled={isFileActive || automationLoading}
                  />
                  <span className="toggle-slider" />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Monitor size={14} /> Show Browser</span>
              </label>
            </div>
          </div>

          <DataTable
            data={processedData}
            columns={columns}
            keyField="_id"
            serverSide={true}
            showFilters={true}
            currentPage={tableParams.page}
            limit={tableParams.limit}
            totalRecords={totalRecords}
            totalPages={totalPages}
            onTableChange={handleTableChange}
            onExport={handleExport}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        loading={automationLoading}
        type="danger"
        confirmText="Stop Job"
      />

      {selectedScreenshot && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedScreenshot(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <button
              type="button"
              onClick={() => setSelectedScreenshot(null)}
              style={{ position: 'fixed', top: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: 'none', color: 'white', cursor: 'pointer', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
            >
              <XCircle size={32} />
            </button>
            <img
              src={`http://localhost:5000/${selectedScreenshot}`}
              alt="Screenshot"
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>
      )}
      <style>{`
        .screenshot-hover-wrapper {
          position: relative;
          display: flex;
        }
        .screenshot-popup-preview {
          position: absolute;
          bottom: 100%;
          left: 50%;

          transform: translateX(-50%) translateY(-8px);
          padding: 6px;
          background: var(--bg-surface, #1e293b);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          z-index: 100;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
          pointer-events: none;
        }
        .screenshot-hover-wrapper:hover .screenshot-popup-preview {
          opacity: 1;
          visibility: visible;
          z-index: 100;
          transform: translateX(-50%) translateY(-12px);
        }
        .screenshot-popup-preview::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -6px;
          z-index: 100;
          border-width: 6px;
          border-style: solid;
          border-color: rgba(255, 255, 255, 0.1) transparent transparent transparent;
        }
      `}</style>
    </>
  );
}

export default JobDetails;
