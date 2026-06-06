import { Bot, Download, FileCheck2 } from 'lucide-react';
import { useState } from 'react';
import { downloadProtectedFile } from '../api/client';

function formatScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${number.toFixed(Number.isInteger(number) ? 0 : 1)}%`;
}

function getReportByType(reports, type) {
  const list = Array.isArray(reports) ? reports : [];
  const exact = list.find((report) => report.report_type === type);
  if (exact) return exact;

  const nameMatch = list.find((report) => {
    const fileName = report.original_file_name || '';
    if (type === 'ai') return /\bai\b|ai-|ai_|aigenerated|chatgpt/i.test(fileName);
    return /similarity|plagiarism|turnitin/i.test(fileName);
  });
  if (nameMatch) return nameMatch;

  return type === 'similarity' ? list[0] : list[1];
}

export default function ReportDownloadActions({
  reports = [],
  aiScore,
  similarityScore,
  compact = false
}) {
  const [message, setMessage] = useState('');
  const actions = [
    {
      type: 'ai',
      label: 'AI report',
      score: formatScore(aiScore),
      icon: Bot,
      report: getReportByType(reports, 'ai')
    },
    {
      type: 'similarity',
      label: 'Similarity report',
      score: formatScore(similarityScore),
      icon: FileCheck2,
      report: getReportByType(reports, 'similarity')
    }
  ];

  async function download(report) {
    setMessage('');
    try {
      await downloadProtectedFile(`/download/report-files/${report.id}`, report.original_file_name);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className={`report-actions ${compact ? 'compact' : ''}`}>
      {actions.map(({ icon: Icon, label, report, score, type }) => {
        const expired = Boolean(report?.deleted_at);
        return (
          <button
            className="report-download-button"
            disabled={!report || expired}
            key={type}
            onClick={() => report && !expired && download(report)}
            type="button"
          >
            {report && !expired ? <Download size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
            <span>{expired ? `${label} expired` : label}</span>
            {score ? <small>{score}</small> : null}
          </button>
        );
      })}
      {message ? <small className="inline-error">{message}</small> : null}
    </div>
  );
}
