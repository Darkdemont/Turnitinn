import { UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../api/client';
import { formatBytes } from '../utils/format';
import FormMessage from './FormMessage';

const MAX_FILES_PER_SUBMISSION = 20;

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

export default function WholesalerUploadForm({ onSubmitted }) {
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [warning, setWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      if (nextFiles.length > MAX_FILES_PER_SUBMISSION) {
        setMessage(`You selected ${nextFiles.length} files. Submit up to ${MAX_FILES_PER_SUBMISSION} files at once.`);
      }
      return nextFiles;
    });
    setFileInputKey((key) => key + 1);
  }

  function removeSelectedFile(index) {
    setFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index));
    setFileInputKey((key) => key + 1);
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
    if (files.length > MAX_FILES_PER_SUBMISSION) {
      setMessage(`Submit up to ${MAX_FILES_PER_SUBMISSION} files at once.`);
      return;
    }

    const body = new FormData();
    files.forEach((file) => body.append('files', file));

    setSubmitting(true);
    try {
      const data = await apiRequest('/wholesaler/orders', {
        method: 'POST',
        body
      });
      setFiles([]);
      setFileInputKey((key) => key + 1);
      setMessageType('success');
      setMessage(`${data.order.order_number} submitted with ${data.order.file_count} file(s).`);
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
    <form className="simple-submit-panel wholesaler-submit-panel" onSubmit={handleSubmit}>
      <div className="submit-main">
        <div className="submit-section-title">
          <div>
            <h2>Bulk File Submission</h2>
            <span>Upload assignment files now. Admin will clear billing later.</span>
          </div>
          <small>pdf, doc, docx, txt, zip</small>
        </div>

        <label className={`primary-file-drop ${files.length ? 'has-files' : ''}`}>
          <UploadCloud size={36} aria-hidden="true" />
          <strong>Choose wholesaler files</strong>
          <span>{files.length ? `${files.length} file(s) ready to submit` : 'Choose files one by one or all together'}</span>
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

        <div className="wholesaler-submit-footer">
          <div>
            <strong>{files.length}</strong>
            <span>file(s) selected</span>
          </div>
          <button className="primary-button submit-order-button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit files'}
          </button>
        </div>

        <FormMessage type={messageType}>{message}</FormMessage>
        <FormMessage type="warning">{warning}</FormMessage>
      </div>
    </form>
  );
}
