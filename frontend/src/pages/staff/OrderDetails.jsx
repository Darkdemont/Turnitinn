import { CheckCircle2, Download, UploadCloud, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest, downloadProtectedFile } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatBytes, formatDate, serviceLabel } from '../../utils/format';

export default function StaffOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [reportUploads, setReportUploads] = useState([]);
  const [reportMeta, setReportMeta] = useState({
    similarity_score: '',
    ai_score: ''
  });
  const [aiSkipped, setAiSkipped] = useState(false);
  const [aiSkipReason, setAiSkipReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOrder() {
    const response = await apiRequest(`/staff/orders/${id}`);
    setData(response);
  }

  useEffect(() => {
    loadOrder().catch((err) => setMessage(err.message));
  }, [id]);

  useEffect(() => {
    if (data?.order) {
      setReportUploads(Array.from({ length: data.order.file_count }, () => ({ similarity: null, ai: null })));
      if (data.order.ai_skipped) {
        setAiSkipped(true);
        setAiSkipReason(data.order.ai_skip_reason || '');
      }
    }
  }, [data?.order?.file_count, data?.order?.ai_skipped, data?.order?.ai_skip_reason]);

  async function acceptOrder() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/staff/orders/${id}/accept`, { method: 'POST' });
      await loadOrder();
      setMessage('Order accepted.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function declineOrder() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/staff/orders/${id}/decline`, { method: 'POST' });
      navigate('/staff/available-orders', { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function releaseOrder() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/staff/orders/${id}/release`, { method: 'POST' });
      await loadOrder();
      setMessage('Order released back to the available queue.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(file) {
    setMessage('');
    try {
      await downloadProtectedFile(`/download/order-files/${file.id}`, file.original_file_name);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function downloadReport(report) {
    setMessage('');
    try {
      await downloadProtectedFile(`/download/report-files/${report.id}`, report.original_file_name);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateUpload(fileIndex, type, file) {
    setReportUploads((prev) => prev.map((item, i) => i === fileIndex ? { ...item, [type]: file } : item));
  }

  async function uploadReport(event) {
    event.preventDefault();
    if (aiSkipped && !aiSkipReason.trim()) {
      setMessage('Add a reason why the AI report is not applicable.');
      return;
    }
    for (let i = 0; i < reportUploads.length; i++) {
      const slot = reportUploads[i];
      const label = reportUploads.length > 1 ? ` for file ${i + 1}` : '';
      if (!slot.similarity) {
        setMessage(`Select the similarity report${label} before uploading.`);
        return;
      }
      if (!aiSkipped && order.service_type === 'ai_similarity' && !slot.ai) {
        setMessage(`Select the AI report${label} before uploading.`);
        return;
      }
    }
    setBusy(true);
    setMessage('');
    const body = new FormData();
    for (const slot of reportUploads) {
      body.append('reports', slot.similarity);
      if (!aiSkipped && order.service_type === 'ai_similarity') {
        body.append('reports', slot.ai);
      }
    }
    if (reportMeta.similarity_score !== '') body.append('similarity_score', reportMeta.similarity_score);
    if (!aiSkipped && reportMeta.ai_score !== '') body.append('ai_score', reportMeta.ai_score);
    if (aiSkipped) {
      body.append('ai_skipped', 'true');
      body.append('ai_skip_reason', aiSkipReason.trim());
    }
    try {
      await apiRequest(`/staff/orders/${id}/reports`, { method: 'POST', body });
      setReportUploads(Array.from({ length: order.file_count }, () => ({ similarity: null, ai: null })));
      setReportMeta({ similarity_score: '', ai_score: '' });
      setAiSkipped(false);
      setAiSkipReason('');
      await loadOrder();
      setMessage('Reports uploaded.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function completeOrder() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/staff/orders/${id}/complete`, { method: 'POST' });
      await loadOrder();
      setMessage('Order marked completed.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (message && !data) return <EmptyState title="Could not load order" text={message} />;
  if (!data) return <div className="screen-loader">Loading order...</div>;

  const { order, files, reports, can_download_order_files: canDownload } = data;
  const isAvailable = order.order_status === 'available';
  const isCompleted = order.order_status === 'completed';
  const canRelease = ['accepted', 'checking'].includes(order.order_status) && reports.length === 0;

  return (
    <>
      <PageHeader
        title={order.order_number}
        eyebrow="staff order"
        actions={
          isAvailable ? (
            <div className="button-row compact">
              <button className="primary-button" onClick={acceptOrder} disabled={busy}>
                <CheckCircle2 size={18} aria-hidden="true" />
                {busy ? 'Accepting...' : 'Accept order'}
              </button>
              <button className="ghost-button danger" onClick={declineOrder} disabled={busy} type="button">
                <XCircle size={18} aria-hidden="true" />
                Decline
              </button>
            </div>
          ) : canRelease ? (
            <button className="ghost-button danger" onClick={releaseOrder} disabled={busy}>
              {busy ? 'Releasing...' : 'Release order'}
            </button>
          ) : null
        }
      />
      <FormMessage type={message.includes('already') || message.includes('Could') || message.includes('cannot') ? 'error' : 'success'}>
        {message}
      </FormMessage>

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header"><h2>Order</h2></div>
          <dl className="detail-list">
            <div><dt>Order ID</dt><dd>{order.order_number}</dd></div>
            <div><dt>Service</dt><dd>{serviceLabel(order.service_type)}</dd></div>
            <div><dt>Files</dt><dd>{order.file_count}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={order.order_status} /></dd></div>
            <div>
              <dt>AI score</dt>
              <dd>
                {order.ai_skipped
                  ? `Not applicable${order.ai_skip_reason ? ` — ${order.ai_skip_reason}` : ''}`
                  : order.ai_score ?? '-'}
              </dd>
            </div>
            <div><dt>Similarity score</dt><dd>{order.similarity_score ?? '-'}</dd></div>
            <div><dt>Accepted</dt><dd>{formatDate(order.accepted_at)}</dd></div>
            <div><dt>Completed</dt><dd>{formatDate(order.completed_at)}</dd></div>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Final reports</h2></div>
          {reports.length ? (
            <div className="file-list">
              {reports.map((report) => (
                <div className="file-row" key={report.id}>
                  <div>
                    <span>{report.original_file_name}</span>
                    <small>{formatBytes(report.file_size)} - {formatDate(report.uploaded_at)}</small>
                  </div>
                  <button className="ghost-button" onClick={() => downloadReport(report)}>
                    <Download size={18} aria-hidden="true" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No report uploaded" text="Upload the final report before completing the order." />
          )}
        </div>
      </section>

      {canDownload ? (
        <section className="panel">
          <div className="panel-header"><h2>Assignment files</h2></div>
          <div className="file-list">
            {files.map((file) => (
              <div className="file-row" key={file.id}>
                <div>
                  <span>{file.original_file_name}</span>
                  <small>
                    {formatBytes(file.file_size)} - {formatDate(file.uploaded_at)}
                    {file.word_count != null ? ` - ${file.word_count.toLocaleString()} words` : ''}
                    {file.word_count_warning ? ' (outside 300-28,000 range)' : ''}
                    {file.language_warning ? ' (Sinhala text detected)' : ''}
                  </small>
                </div>
                <button className="ghost-button" onClick={() => downloadFile(file)}>
                  <Download size={18} aria-hidden="true" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isAvailable && !isCompleted ? (
        <section className="panel action-panel">
          <form className="form-stack" onSubmit={uploadReport}>
            {(() => {
              const reportsPerFile = order.service_type === 'ai_similarity' && !order.ai_skipped ? 2 : 1;
              const totalRequired = order.file_count * reportsPerFile;
              return (
                <div className="panel-header">
                  <h2>Upload checked reports</h2>
                  <span className="muted-label">{reports.length}/{totalRequired} uploaded</span>
                </div>
              );
            })()}

            {reportUploads.map((slot, i) => (
              <div key={i} className="report-file-group">
                {order.file_count > 1 && (
                  <div className="report-file-label">File {i + 1}</div>
                )}
                <div className="report-upload-grid">
                  <label>
                    {order.file_count > 1 ? `Similarity report ${i + 1}` : 'Similarity report'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.zip"
                      onChange={(e) => updateUpload(i, 'similarity', e.target.files?.[0] || null)}
                    />
                  </label>
                  {!aiSkipped && order.service_type === 'ai_similarity' ? (
                    <label>
                      {order.file_count > 1 ? `AI report ${i + 1}` : 'AI report'}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.zip"
                        onChange={(e) => updateUpload(i, 'ai', e.target.files?.[0] || null)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}

            {order.service_type === 'ai_similarity' ? (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={aiSkipped}
                  onChange={(event) => {
                    setAiSkipped(event.target.checked);
                    if (event.target.checked) {
                      setReportUploads((prev) => prev.map((s) => ({ ...s, ai: null })));
                      setReportMeta((current) => ({ ...current, ai_score: '' }));
                    }
                  }}
                />
                AI report not applicable (document word count exceeds the AI tool's limit)
              </label>
            ) : null}
            {aiSkipped ? (
              <label>
                Reason AI report is not applicable (shown to the customer/wholesaler)
                <input
                  type="text"
                  maxLength={300}
                  value={aiSkipReason}
                  onChange={(event) => setAiSkipReason(event.target.value)}
                  placeholder="e.g. Document is 34,000 words, over the AI tool's 30,000 word limit"
                />
              </label>
            ) : null}
            <div className="report-upload-grid">
              <label>
                Similarity %
                <input
                  min="0" max="100" step="0.1" type="number"
                  value={reportMeta.similarity_score}
                  onChange={(e) => setReportMeta({ ...reportMeta, similarity_score: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              {!aiSkipped && order.service_type === 'ai_similarity' ? (
                <label>
                  AI %
                  <input
                    min="0" max="100" step="0.1" type="number"
                    value={reportMeta.ai_score}
                    onChange={(e) => setReportMeta({ ...reportMeta, ai_score: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
              ) : null}
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={busy}>
                <UploadCloud size={18} aria-hidden="true" />
                {busy ? 'Uploading...' : 'Upload reports'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={completeOrder}
                disabled={busy || reports.length < order.file_count * (order.ai_skipped || order.service_type === 'similarity_only' ? 1 : 2)}
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                Mark completed
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
