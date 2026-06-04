import { CheckCircle2, Download, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest, downloadProtectedFile } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatBytes, formatDate, serviceLabel } from '../../utils/format';

export default function StaffOrderDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [reportUploads, setReportUploads] = useState({
    similarity: null,
    ai: null
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOrder() {
    const response = await apiRequest(`/staff/orders/${id}`);
    setData(response);
  }

  useEffect(() => {
    loadOrder().catch((err) => setMessage(err.message));
  }, [id]);

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

  async function uploadReport(event) {
    event.preventDefault();
    if (!reportUploads.similarity || !reportUploads.ai) {
      setMessage('Select both report files before uploading.');
      return;
    }
    setBusy(true);
    setMessage('');
    const body = new FormData();
    body.append('reports', reportUploads.similarity);
    body.append('reports', reportUploads.ai);
    try {
      await apiRequest(`/staff/orders/${id}/reports`, {
        method: 'POST',
        body
      });
      setReportUploads({ similarity: null, ai: null });
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
      await apiRequest(`/staff/orders/${id}/complete`, { method: 'PATCH' });
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

  return (
    <>
      <PageHeader
        title={order.order_number}
        eyebrow="staff order"
        actions={
          isAvailable ? (
            <button className="primary-button" onClick={acceptOrder} disabled={busy}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {busy ? 'Accepting...' : 'Accept order'}
            </button>
          ) : null
        }
      />
      <FormMessage type={message.includes('already') || message.includes('Could') ? 'error' : 'success'}>
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
                  <small>{formatBytes(file.file_size)} - {formatDate(file.uploaded_at)}</small>
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
            <div className="panel-header">
              <h2>Upload checked reports</h2>
              <span className="muted-label">{reports.length}/2 uploaded</span>
            </div>
            <div className="report-upload-grid">
              <label>
                Similarity report
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.zip"
                  onChange={(event) =>
                    setReportUploads({
                      ...reportUploads,
                      similarity: event.target.files?.[0] || null
                    })
                  }
                />
              </label>
              <label>
                AI report
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.zip"
                  onChange={(event) =>
                    setReportUploads({
                      ...reportUploads,
                      ai: event.target.files?.[0] || null
                    })
                  }
                />
              </label>
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
                disabled={busy || reports.length < 2}
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
