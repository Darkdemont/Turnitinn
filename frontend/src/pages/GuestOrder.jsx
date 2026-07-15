import { CheckCircle2, Clock, Download, FileText, Upload, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

function serviceLabel(type) {
  if (type === 'similarity_only') return 'Similarity check only';
  if (type === 'ai_similarity') return 'Similarity + AI detection check';
  return type;
}

function StatusBanner({ status, order }) {
  if (status === 'uploaded' || (order && !['completed'].includes(order.order_status))) {
    return (
      <div className="guest-status-card">
        <div className="guest-status-icon pending"><Clock size={48} /></div>
        <h2>Files received</h2>
        <p>Your assignment is being reviewed by our team. This usually takes a few hours.</p>
        <p className="guest-muted">Keep this page bookmarked — your reports will appear here once ready.</p>
      </div>
    );
  }
  if (status === 'completed' || order?.order_status === 'completed') {
    return null;
  }
  return null;
}

export default function GuestOrder() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function load() {
    try {
      const result = await apiFetch(`/guest/${token}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [token]);

  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    const max = data?.file_slots || 1;
    setFiles(selected.slice(0, max));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    const max = data?.file_slots || 1;
    setFiles(dropped.slice(0, max));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!files.length) {
      setUploadMessage('Please select at least one file.');
      return;
    }
    setUploading(true);
    setUploadMessage('');
    const body = new FormData();
    for (const file of files) body.append('files', file);
    try {
      await apiFetch(`/guest/${token}/upload`, { method: 'POST', body });
      await load();
      setFiles([]);
    } catch (err) {
      setUploadMessage(err.message);
    } finally {
      setUploading(false);
    }
  }

  function downloadReport(reportId, fileName) {
    window.location.href = `${API}/guest/${token}/download/${reportId}`;
  }

  if (error) {
    return (
      <div className="guest-page">
        <div className="guest-card">
          <div className="guest-brand">Turnit</div>
          <div className="guest-status-card">
            <div className="guest-status-icon error"><XCircle size={48} /></div>
            <h2>Link unavailable</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="guest-page">
        <div className="guest-card">
          <div className="guest-brand">Turnit</div>
          <div className="guest-loader">Loading...</div>
        </div>
      </div>
    );
  }

  const isCompleted = data.status === 'completed' || data.order?.order_status === 'completed';
  const isUploaded = data.status === 'uploaded' && !isCompleted;
  const isPending = data.status === 'pending';

  return (
    <div className="guest-page">
      <div className="guest-card">
        <div className="guest-brand">Turnit</div>
        <div className="guest-service-tag">{serviceLabel(data.service_type)}</div>
        {data.note && <div className="guest-note">For: {data.note}</div>}

        {isPending && (
          <form className="guest-upload-form" onSubmit={handleSubmit}>
            <h2 className="guest-upload-title">Upload your assignment</h2>
            <p className="guest-upload-desc">
              Upload up to <strong>{data.file_slots}</strong> file{data.file_slots > 1 ? 's' : ''}.
              Accepted formats: PDF, DOC, DOCX, TXT, ZIP.
            </p>

            <div
              className={`guest-dropzone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={32} className="guest-drop-icon" />
              <span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click or drag files here'}</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple={data.file_slots > 1}
                accept=".pdf,.doc,.docx,.txt,.zip"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {files.length > 0 && (
              <ul className="guest-file-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <FileText size={15} />
                    <span>{f.name}</span>
                    <span className="guest-file-size">({(f.size / 1024).toFixed(0)} KB)</span>
                  </li>
                ))}
              </ul>
            )}

            {uploadMessage && <div className="guest-error">{uploadMessage}</div>}

            <button className="guest-submit-btn" type="submit" disabled={uploading || !files.length}>
              {uploading ? 'Uploading...' : 'Submit files'}
            </button>
          </form>
        )}

        {isUploaded && <StatusBanner status={data.status} order={data.order} />}

        {isCompleted && (
          <div className="guest-status-card">
            <div className="guest-status-icon success"><CheckCircle2 size={48} /></div>
            <h2>Your reports are ready</h2>
            {data.order?.similarity_score != null && (
              <div className="guest-scores">
                <span>Similarity: <strong>{data.order.similarity_score}%</strong></span>
                {data.order.ai_score != null && <span>AI: <strong>{data.order.ai_score}%</strong></span>}
                {data.order.ai_skipped && <span className="guest-muted">AI check not applicable — {data.order.ai_skip_reason}</span>}
              </div>
            )}
            <div className="guest-report-list">
              {(data.reports || []).map((r) => (
                <button
                  key={r.id}
                  className="guest-download-btn"
                  onClick={() => downloadReport(r.id, r.original_file_name)}
                >
                  <Download size={16} />
                  {r.original_file_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="guest-footer">turnnchecker.com · Turnit Assignment Checking</div>
      </div>
    </div>
  );
}
