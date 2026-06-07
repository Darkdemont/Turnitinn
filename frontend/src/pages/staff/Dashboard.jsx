import { CheckCircle2, Download, FileText, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, downloadProtectedFile } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import StatusBadge from '../../components/StatusBadge';
import { accountTypeLabel, formatBytes, formatDate, formatUsd, serviceLabel } from '../../utils/format';

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  const [downloadBusyId, setDownloadBusyId] = useState(null);
  const [reportUploads, setReportUploads] = useState({});
  const [reportMeta, setReportMeta] = useState({});
  const [uploadBusyId, setUploadBusyId] = useState(null);
  const [completeBusyId, setCompleteBusyId] = useState(null);
  const [releaseBusyId, setReleaseBusyId] = useState(null);
  const [uploadResetKeys, setUploadResetKeys] = useState({});

  const loadDashboard = useCallback(async () => {
    const response = await apiRequest('/staff/dashboard');
    setData(response);
  }, []);

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));

    const intervalId = window.setInterval(() => {
      loadDashboard().catch(() => {});
    }, 10000);

    function refreshWhenVisible() {
      if (!document.hidden) {
        loadDashboard().catch(() => {});
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [loadDashboard]);

  async function acceptOrder(orderId) {
    setMessage('');
    setAcceptingId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/accept`, { method: 'POST' });
      const accepted = await apiRequest(`/staff/orders/${orderId}`);
      if (accepted.files?.length === 1) {
        await downloadProtectedFile(
          `/download/order-files/${accepted.files[0].id}`,
          accepted.files[0].original_file_name
        );
      }
      await loadDashboard();
      setMessage(
        accepted.files?.length === 1
          ? 'Order accepted. File download started and upload slots are ready.'
          : 'Order accepted. Download files from My active work.'
      );
    } catch (err) {
      setMessage(err.message);
      await loadDashboard().catch(() => {});
    } finally {
      setAcceptingId(null);
    }
  }

  async function declineOrder(orderId) {
    setMessage('');
    setDecliningId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/decline`, { method: 'PATCH' });
      await loadDashboard();
      setMessage('Order declined. It will not show in your queue again.');
    } catch (err) {
      setMessage(err.message);
      await loadDashboard().catch(() => {});
    } finally {
      setDecliningId(null);
    }
  }

  async function downloadFile(file, quiet = false) {
    setMessage('');
    try {
      await downloadProtectedFile(`/download/order-files/${file.id}`, file.original_file_name);
    } catch (err) {
      if (!quiet) setMessage(err.message);
      throw err;
    }
  }

  async function downloadOrderFiles(order) {
    if (!order.files?.length) return;
    setMessage('');
    setDownloadBusyId(order.id);
    try {
      for (const file of order.files) {
        await downloadFile(file, true);
      }
      setMessage(order.files.length === 1 ? 'File download started.' : 'File downloads started.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDownloadBusyId(null);
    }
  }

  function updateReportUpload(orderId, type, file) {
    setReportUploads((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [type]: file
      }
    }));
  }

  function updateReportMeta(orderId, field, value) {
    setReportMeta((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [field]: value
      }
    }));
  }

  function resetQuickUpload(orderId) {
    setReportUploads((current) => ({
      ...current,
      [orderId]: { similarity: null, ai: null }
    }));
    setReportMeta((current) => ({
      ...current,
      [orderId]: { similarity_score: '', ai_score: '' }
    }));
    setUploadResetKeys((current) => ({
      ...current,
      [orderId]: (current[orderId] || 0) + 1
    }));
  }

  async function uploadReports(event, orderId) {
    event.preventDefault();
    const uploads = reportUploads[orderId] || {};
    const meta = reportMeta[orderId] || {};

    if (!uploads.similarity || !uploads.ai) {
      setMessage('Select both report files before uploading.');
      return;
    }

    setMessage('');
    setUploadBusyId(orderId);
    const body = new FormData();
    body.append('reports', uploads.similarity);
    body.append('reports', uploads.ai);
    if (meta.similarity_score !== undefined && meta.similarity_score !== '') {
      body.append('similarity_score', meta.similarity_score);
    }
    if (meta.ai_score !== undefined && meta.ai_score !== '') {
      body.append('ai_score', meta.ai_score);
    }

    try {
      await apiRequest(`/staff/orders/${orderId}/reports`, {
        method: 'POST',
        body
      });
      resetQuickUpload(orderId);
      await loadDashboard();
      setMessage('Reports uploaded. You can mark the order completed now.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploadBusyId(null);
    }
  }

  async function completeOrder(orderId) {
    setMessage('');
    setCompleteBusyId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/complete`, { method: 'PATCH' });
      await loadDashboard();
      setMessage('Order marked completed.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setCompleteBusyId(null);
    }
  }

  async function releaseOrder(orderId) {
    setMessage('');
    setReleaseBusyId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/release`, { method: 'PATCH' });
      resetQuickUpload(orderId);
      await loadDashboard();
      setMessage('Order released back to the available queue.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setReleaseBusyId(null);
    }
  }

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary;
  const availableOrders = data.available_orders || [];
  const activeOrders = data.active_orders || data.recent_orders || [];

  return (
    <div className="staff-dashboard-page">
      <section className="staff-dashboard-hero">
        <div>
          <span className="eyebrow">queue</span>
          <h1>Staff Dashboard</h1>
        </div>
        <Link className="secondary-button staff-queue-link" to="/staff/available-orders">
          <FileText size={18} aria-hidden="true" />
          Full queue
        </Link>

        <div className="staff-mini-metrics" aria-label="Staff summary">
          <div className="staff-mini-metric">
            <span>Available</span>
            <strong>{summary.available_orders}</strong>
          </div>
          <div className="staff-mini-metric">
            <span>Active</span>
            <strong>{summary.my_active_orders}/{summary.max_active_orders || 3}</strong>
            <small>{summary.remaining_accept_slots ?? 0} slots free</small>
          </div>
          <div className="staff-mini-metric">
            <span>Completed</span>
            <strong>{summary.my_completed_orders}</strong>
          </div>
          <div className="staff-mini-metric">
            <span>Earnings</span>
            <strong>{formatUsd(summary.total_earning_usd)}</strong>
            <small>{summary.total_completed_files} files</small>
          </div>
        </div>
      </section>

      <FormMessage type={message.includes('accepted') || message.includes('started') || message.includes('uploaded') || message.includes('completed') || message.includes('released') || message.includes('declined') ? 'success' : 'error'}>{message}</FormMessage>

      <section className="staff-priority-grid">
        <section className="panel staff-work-panel">
          <div className="panel-header">
            <div>
              <h2>Available orders</h2>
              <span className="muted-label">Accept the next job from the queue.</span>
            </div>
            <Link className="text-link" to="/staff/available-orders">View all</Link>
          </div>
          {availableOrders.length ? (
            <div className="queue-order-list">
              {availableOrders.map((order) => (
                <article className="queue-order-row" key={order.id}>
                  <div className="queue-order-main">
                    <strong>{order.files?.[0]?.original_file_name || order.order_number}</strong>
                    <span>{order.order_number} - {accountTypeLabel(order.account_type)} - {formatDate(order.created_at)}</span>
                    <small>
                      {order.files?.[0]
                        ? `${formatBytes(order.files[0].file_size)}${order.file_count > 1 ? ` first file, ${formatBytes(order.total_file_size)} total` : ''}`
                        : `${order.file_count} file(s)`}
                    </small>
                  </div>
                  <span className="queue-service">{serviceLabel(order.service_type)}</span>
                  <span className="queue-files">{order.file_count} file(s)</span>
                  <div className="queue-actions">
                    <button
                      className="primary-button small"
                      disabled={acceptingId === order.id || decliningId === order.id || summary.remaining_accept_slots <= 0}
                      onClick={() => acceptOrder(order.id)}
                      type="button"
                    >
                      <CheckCircle2 size={18} aria-hidden="true" />
                      {acceptingId === order.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      className="ghost-button small-inline danger"
                      disabled={acceptingId === order.id || decliningId === order.id}
                      onClick={() => declineOrder(order.id)}
                      type="button"
                    >
                      <XCircle size={16} aria-hidden="true" />
                      {decliningId === order.id ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No available orders" text="New paid customer submissions will appear here." />
          )}
        </section>

        <section className="panel staff-work-panel">
          <div className="panel-header">
            <div>
              <h2>My active work</h2>
              <span className="muted-label">Download files, upload reports, then complete.</span>
            </div>
            <Link className="text-link" to="/staff/orders">View all</Link>
          </div>
          {activeOrders.length ? (
            <div className="active-work-list">
              {activeOrders.map((order) => {
                const uploads = reportUploads[order.id] || {};
                const meta = reportMeta[order.id] || {};
                const resetKey = uploadResetKeys[order.id] || 0;
                const firstFileName = order.files?.[0]?.original_file_name;

                return (
                  <article className="active-work-item" key={order.id}>
                    <div className="active-work-top">
                      <div className="active-work-title">
                        <strong>{firstFileName || order.order_number}</strong>
                        <span>{order.order_number} - {order.file_count} file(s)</span>
                      </div>
                      <StatusBadge value={order.order_status} />
                    </div>

                    <div className="active-work-actions">
                      <button
                        className="ghost-button small-inline"
                        disabled={downloadBusyId === order.id || !order.files?.length}
                        onClick={() => downloadOrderFiles(order)}
                        type="button"
                      >
                        <Download size={16} aria-hidden="true" />
                        {downloadBusyId === order.id ? 'Downloading...' : 'Download files'}
                      </button>
                      <Link className="secondary-button small-inline" to={`/staff/orders/${order.id}`}>
                        Full work
                      </Link>
                      <button
                        className="ghost-button small-inline danger"
                        disabled={releaseBusyId === order.id || (order.report_count || 0) > 0}
                        onClick={() => releaseOrder(order.id)}
                        type="button"
                      >
                        {releaseBusyId === order.id ? 'Releasing...' : 'Release'}
                      </button>
                    </div>

                    <form className="quick-report-form" onSubmit={(event) => uploadReports(event, order.id)}>
                      <div className="quick-report-grid">
                        <label className="quick-report-slot">
                          Similarity report
                          <input
                            key={`similarity-${order.id}-${resetKey}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.zip"
                            onChange={(event) =>
                              updateReportUpload(order.id, 'similarity', event.target.files?.[0] || null)
                            }
                          />
                        </label>
                        <label className="quick-report-slot">
                          AI report
                          <input
                            key={`ai-${order.id}-${resetKey}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.zip"
                            onChange={(event) =>
                              updateReportUpload(order.id, 'ai', event.target.files?.[0] || null)
                            }
                          />
                        </label>
                      </div>

                      <div className="quick-score-grid">
                        <label>
                          Similarity %
                          <input
                            min="0"
                            max="100"
                            step="0.1"
                            type="number"
                            value={meta.similarity_score || ''}
                            onChange={(event) =>
                              updateReportMeta(order.id, 'similarity_score', event.target.value)
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <label>
                          AI %
                          <input
                            min="0"
                            max="100"
                            step="0.1"
                            type="number"
                            value={meta.ai_score || ''}
                            onChange={(event) => updateReportMeta(order.id, 'ai_score', event.target.value)}
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      <div className="quick-report-footer">
                        <span className="muted-label">{order.report_count || 0}/2 reports uploaded</span>
                        <div className="button-row compact">
                          <button
                            className="primary-button small"
                            disabled={
                              uploadBusyId === order.id ||
                              (order.report_count || 0) >= 2 ||
                              !uploads.similarity ||
                              !uploads.ai
                            }
                            type="submit"
                          >
                            {(order.report_count || 0) >= 2
                              ? 'Reports uploaded'
                              : uploadBusyId === order.id
                                ? 'Uploading...'
                                : 'Upload reports'}
                          </button>
                          <button
                            className="secondary-button small"
                            disabled={completeBusyId === order.id || (order.report_count || 0) < 2}
                            onClick={() => completeOrder(order.id)}
                            type="button"
                          >
                            <CheckCircle2 size={16} aria-hidden="true" />
                            {completeBusyId === order.id ? 'Completing...' : 'Complete'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No active work" text="Accepted orders stay here until completed." />
          )}
        </section>
      </section>
    </div>
  );
}
