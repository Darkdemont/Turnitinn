import { UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { formatBytes, formatLkr } from '../utils/format';
import FormMessage from './FormMessage';

const PRICE_PER_FILE = 450;

const packages = [
  {
    value: 1,
    label: '1 file',
    fileCount: 1
  },
  {
    value: 5,
    label: '5 files',
    fileCount: 5
  },
  {
    value: 10,
    label: '10 files',
    fileCount: 10
  }
];

export default function OrderUploadForm({ availablePackages = [] }) {
  const navigate = useNavigate();
  const hasPackageBalance = availablePackages.length > 0;
  const [mode, setMode] = useState(hasPackageBalance ? 'existing' : 'new');
  const [selectedPackage, setSelectedPackage] = useState(packages[0]);
  const [selectedExistingPackageId, setSelectedExistingPackageId] = useState(
    availablePackages[0]?.id || ''
  );
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedExistingPackage = availablePackages.find(
    (item) => Number(item.id) === Number(selectedExistingPackageId)
  );
  const maxFileCount =
    mode === 'existing'
      ? Number(selectedExistingPackage?.remaining_file_count || 0)
      : selectedPackage.fileCount;
  const total = useMemo(() => {
    if (mode === 'existing') return 0;
    return PRICE_PER_FILE * selectedPackage.fileCount;
  }, [mode, selectedPackage.fileCount]);
  const canUseSelectedCount = files.length > 0 && files.length <= maxFileCount;

  useEffect(() => {
    if (!hasPackageBalance && mode === 'existing') {
      setMode('new');
    }
    if (hasPackageBalance && !selectedExistingPackageId) {
      setSelectedExistingPackageId(availablePackages[0].id);
    }
  }, [availablePackages, hasPackageBalance, mode, selectedExistingPackageId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!files.length) {
      setMessage('Select at least one assignment file.');
      return;
    }
    if (!canUseSelectedCount) {
      setMessage(`You can upload up to ${maxFileCount} file(s) for this submission.`);
      return;
    }

    const body = new FormData();
    body.append('service_type', 'ai_similarity');
    if (mode === 'existing') {
      body.append('package_id', String(selectedExistingPackageId));
    } else {
      body.append('package_file_count', String(selectedPackage.fileCount));
    }
    files.forEach((file) => body.append('files', file));

    setSubmitting(true);
    try {
      const data = await apiRequest('/customer/orders', {
        method: 'POST',
        body
      });
      navigate(`/customer/orders/${data.order.id}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="simple-submit-panel" onSubmit={handleSubmit}>
      <div className="simple-submit-layout">
        <section className="submit-main">
          <div className="submit-section-title">
            <div>
              <h2>Submit Documents</h2>
              <span>AI + Similarity report</span>
            </div>
            <small>pdf, doc, docx, txt, zip</small>
          </div>

          <label className={`primary-file-drop ${files.length ? 'has-files' : ''}`}>
            <UploadCloud size={36} aria-hidden="true" />
            <strong>Choose assignment files</strong>
            <span>{files.length ? `${files.length} file(s) selected` : 'No files selected'}</span>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.zip"
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
          </label>

          {files.length ? (
            <div className="file-list compact-files">
              {files.map((file) => (
                <div className="file-row" key={`${file.name}-${file.size}`}>
                  <span>{file.name}</span>
                  <small>{formatBytes(file.size)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="submit-side">
          <div>
            <h2>Select Package</h2>
            <span className="muted-label">
              {mode === 'existing' ? 'Use remaining file credits' : `${formatLkr(PRICE_PER_FILE)} per file`}
            </span>
          </div>

          {hasPackageBalance ? (
            <div className="mode-toggle" role="tablist" aria-label="Package mode">
              <button
                type="button"
                className={mode === 'existing' ? 'active' : ''}
                onClick={() => setMode('existing')}
              >
                Use balance
              </button>
              <button
                type="button"
                className={mode === 'new' ? 'active' : ''}
                onClick={() => setMode('new')}
              >
                Buy package
              </button>
            </div>
          ) : null}

          {mode === 'existing' ? (
            <div className="package-list">
              {availablePackages.map((item) => (
                <label
                  key={item.id}
                  className={`package-row ${Number(selectedExistingPackageId) === Number(item.id) ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="existing_package"
                    value={item.id}
                    checked={Number(selectedExistingPackageId) === Number(item.id)}
                    onChange={() => setSelectedExistingPackageId(item.id)}
                  />
                  <span>{item.package_number}</span>
                  <strong>{item.remaining_file_count} left</strong>
                </label>
              ))}
            </div>
          ) : (
            <div className="package-list" role="radiogroup" aria-label="Package">
              {packages.map((item) => (
                <label
                  key={item.value}
                  className={`package-row ${selectedPackage.value === item.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="package"
                    value={item.value}
                    checked={selectedPackage.value === item.value}
                    onChange={() => setSelectedPackage(item)}
                  />
                  <span>{item.label}</span>
                  <strong>{formatLkr(PRICE_PER_FILE * item.fileCount)}</strong>
                </label>
              ))}
            </div>
          )}

          <div className="payment-box">
            <span>{mode === 'existing' ? 'New payment' : 'Total payment'}</span>
            <strong>{mode === 'existing' ? formatLkr(0) : formatLkr(total)}</strong>
            <small>Uploaded files: {files.length}/{maxFileCount}</small>
          </div>

          <button className="primary-button submit-order-button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : mode === 'existing' ? 'Submit using balance' : 'Buy package & submit'}
          </button>
          <FormMessage type="error">{message}</FormMessage>
        </aside>
      </div>
    </form>
  );
}
