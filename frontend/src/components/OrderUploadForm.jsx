import { UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { formatBytes, formatLkr } from '../utils/format';
import FormMessage from './FormMessage';

const SERVICE_TYPES = [
  {
    value: 'ai_similarity',
    label: 'AI + Similarity check',
    description: 'Detects AI-generated content AND checks similarity',
    pricePerFile: 450
  },
  {
    value: 'similarity_only',
    label: 'Similarity check only',
    description: 'Checks plagiarism similarity only',
    pricePerFile: 350
  }
];

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

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function buildFileWarning(uploadedFiles = []) {
  const notes = uploadedFiles
    .filter((file) => file.language_warning || file.word_count_warning)
    .map((file) => {
      const reasons = [];
      if (file.language_warning) reasons.push('contains Sinhala text');
      if (file.word_count_warning) reasons.push(`word count is ${file.word_count?.toLocaleString() ?? 'out of range'} (supported range is 300-28,000)`);
      return `"${file.original_file_name}" ${reasons.join(' and ')}`;
    });
  if (!notes.length) return '';
  return `Heads up: ${notes.join('; ')}. We only support English assignments within the supported word range - the checking tool may not process this file correctly.`;
}

export default function OrderUploadForm({ availablePackages = [], onSubmitted }) {
  const hasPackageBalance = availablePackages.length > 0;
  const [mode, setMode] = useState(hasPackageBalance ? 'existing' : 'new');
  const [selectedPackage, setSelectedPackage] = useState(packages[0]);
  const [serviceType, setServiceType] = useState('ai_similarity');
  const selectedService = SERVICE_TYPES.find((s) => s.value === serviceType) || SERVICE_TYPES[0];
  const [selectedExistingPackageId, setSelectedExistingPackageId] = useState(
    availablePackages[0]?.id || ''
  );
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [warning, setWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedExistingPackage = availablePackages.find(
    (item) => String(item.id) === String(selectedExistingPackageId)
  );
  const selectedExistingPackageAvailable = availablePackages.some(
    (item) => String(item.id) === String(selectedExistingPackageId)
  );
  const maxFileCount =
    mode === 'existing'
      ? Number(selectedExistingPackage?.remaining_file_count || 0)
      : selectedPackage.fileCount;
  const pricePerFile = selectedService.pricePerFile;
  const total = useMemo(() => {
    if (mode === 'existing') return 0;
    return pricePerFile * selectedPackage.fileCount;
  }, [mode, pricePerFile, selectedPackage.fileCount]);
  const canUseSelectedCount = files.length > 0 && files.length <= maxFileCount;

  useEffect(() => {
    if (!hasPackageBalance && mode === 'existing') {
      setMode('new');
    }
    if (hasPackageBalance && (!selectedExistingPackageId || !selectedExistingPackageAvailable)) {
      setSelectedExistingPackageId(availablePackages[0].id);
    }
  }, [availablePackages, hasPackageBalance, mode, selectedExistingPackageAvailable, selectedExistingPackageId]);

  function removeSelectedFile(index) {
    setFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index));
    setFileInputKey((key) => key + 1);
  }

  function appendSelectedFiles(selectedFiles) {
    setMessage('');
    setMessageType('error');
    setFiles((currentFiles) => {
      const existingKeys = new Set(currentFiles.map(fileKey));
      const nextFiles = [...currentFiles];
      selectedFiles.forEach((file) => {
        if (!existingKeys.has(fileKey(file))) {
          nextFiles.push(file);
        }
      });
      if (nextFiles.length > maxFileCount) {
        setMessage(`You selected ${nextFiles.length} files. This submission allows ${maxFileCount}. Remove extra files before submitting.`);
      }
      return nextFiles;
    });
    setFileInputKey((key) => key + 1);
  }

  const payhereFormRef = useRef(null);

  function submitToPayhere(payhereData) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payhereData.checkout_url;
    form.style.display = 'none';

    Object.entries(payhereData.fields).forEach(([key, val]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = val;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setMessageType('error');
    setWarning('');
    if (!files.length) {
      setMessage('Select at least one assignment file.');
      return;
    }
    if (!canUseSelectedCount) {
      setMessage(`You can upload up to ${maxFileCount} file(s) for this submission.`);
      return;
    }

    const body = new FormData();
    body.append('service_type', serviceType);
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

      if (data.payment_required && data.payhere) {
        setMessageType('success');
        setMessage('Redirecting to payment...');
        setTimeout(() => submitToPayhere(data.payhere), 400);
        return;
      }

      setFiles([]);
      setFileInputKey((key) => key + 1);
      setMessageType('success');
      setMessage(`${data.order.order_number} submitted. You can upload another file now.`);
      setWarning(buildFileWarning(data.files));
      await onSubmitted?.(data);
    } catch (error) {
      setMessageType('error');
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
              key={fileInputKey}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.zip"
              onChange={(event) => appendSelectedFiles(Array.from(event.target.files || []))}
            />
          </label>

          {files.length ? (
            <div className="file-list compact-files">
              {files.map((file, index) => (
                <div className="file-row selectable-file-row" key={`${file.name}-${file.size}-${index}`}>
                  <div>
                    <span>{file.name}</span>
                    <small>{formatBytes(file.size)}</small>
                  </div>
                  <button
                    className="ghost-button small-inline danger"
                    onClick={() => removeSelectedFile(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="submit-side">
          <div>
            <h2>Check type</h2>
          </div>
          <div className="service-type-list">
            {SERVICE_TYPES.map((s) => (
              <label
                key={s.value}
                className={`service-type-row ${serviceType === s.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="service_type"
                  value={s.value}
                  checked={serviceType === s.value}
                  onChange={() => setServiceType(s.value)}
                />
                <div className="service-type-info">
                  <span>{s.label}</span>
                  <small>{s.description}</small>
                </div>
                <strong>{formatLkr(s.pricePerFile)}<span className="per-file">/file</span></strong>
              </label>
            ))}
          </div>

          <div>
            <h2>Package</h2>
            <span className="muted-label">
              {mode === 'existing' ? 'Use remaining file credits' : `${formatLkr(pricePerFile)} per file`}
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
                  className={`package-row ${String(selectedExistingPackageId) === String(item.id) ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="existing_package"
                    value={item.id}
                    checked={String(selectedExistingPackageId) === String(item.id)}
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
                  <strong>{formatLkr(pricePerFile * item.fileCount)}</strong>
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
            {submitting
              ? 'Submitting...'
              : mode === 'existing'
                ? 'Submit using balance'
                : 'Submit order'}
          </button>
          <FormMessage type={messageType}>{message}</FormMessage>
          <FormMessage type="warning">{warning}</FormMessage>
        </aside>
      </div>
    </form>
  );
}
