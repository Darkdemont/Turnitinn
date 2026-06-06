import { HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { formatBytes } from '../../utils/format';

function categoryRows(storage) {
  if (!storage) return [];
  return [
    ['Uploaded files', storage.categories.order_files],
    ['Report files', storage.categories.report_files]
  ];
}

export default function AdminStorage() {
  const [storage, setStorage] = useState(null);
  const [message, setMessage] = useState('');
  const [busyMode, setBusyMode] = useState('');

  async function loadStorage() {
    const data = await apiRequest('/admin/storage');
    setStorage(data.storage);
  }

  useEffect(() => {
    loadStorage().catch((err) => setMessage(err.message));
  }, []);

  async function runCleanup(mode, olderThanHours) {
    const labels = {
      expired: 'Clear expired physical files now?',
      older_than: `Clear physical files older than ${olderThanHours} hours?`,
      all: 'Clear ALL physical upload and report files? Order history and counts will stay, but downloads will expire.'
    };
    const ok = window.confirm(labels[mode]);
    if (!ok) return;

    setBusyMode(mode);
    setMessage('');
    try {
      const data = await apiRequest('/admin/storage/cleanup', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          ...(olderThanHours ? { older_than_hours: olderThanHours } : {})
        })
      });
      setStorage(data.storage);
      setMessage(`Cleared ${data.result.total_files} physical file(s). Database records and order counts were kept.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyMode('');
    }
  }

  const isError = message && !message.includes('Cleared');

  return (
    <>
      <PageHeader title="Storage Cleanup" eyebrow="admin tools" />
      <FormMessage type={isError ? 'error' : 'success'}>{message}</FormMessage>

      {!storage && !message ? <div className="screen-loader">Loading storage...</div> : null}
      {storage ? (
        <>
          <section className="stats-grid">
            <StatCard
              label="Active file storage"
              value={formatBytes(storage.totals.active_bytes)}
              detail={`${storage.totals.active_files} physical files`}
            />
            <StatCard
              label="Expired files"
              value={storage.totals.expired_files}
              detail={formatBytes(storage.totals.expired_bytes)}
            />
            <StatCard
              label="History records kept"
              value={storage.totals.deleted_records}
              detail={formatBytes(storage.totals.deleted_record_bytes)}
            />
            <StatCard
              label="Auto retention"
              value={`${storage.retention_hours}h`}
              detail={`cleanup every ${storage.cleanup_interval_minutes} min`}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>File-only cleanup</h2>
                <span className="muted-label">Deletes Hostinger physical files, keeps MongoDB records and order counts.</span>
              </div>
              <button className="ghost-button" onClick={loadStorage} type="button">
                <RefreshCw size={18} aria-hidden="true" />
                Refresh
              </button>
            </div>
            <div className="cleanup-action-grid">
              <button
                className="secondary-button"
                disabled={Boolean(busyMode)}
                onClick={() => runCleanup('expired')}
                type="button"
              >
                <Trash2 size={18} aria-hidden="true" />
                {busyMode === 'expired' ? 'Clearing...' : 'Clear expired files'}
              </button>
              <button
                className="secondary-button"
                disabled={Boolean(busyMode)}
                onClick={() => runCleanup('older_than', 48)}
                type="button"
              >
                <Trash2 size={18} aria-hidden="true" />
                {busyMode === 'older_than' ? 'Clearing...' : 'Clear files older than 48h'}
              </button>
              <button
                className="ghost-button danger"
                disabled={Boolean(busyMode)}
                onClick={() => runCleanup('all')}
                type="button"
              >
                <HardDrive size={18} aria-hidden="true" />
                {busyMode === 'all' ? 'Clearing...' : 'Clear all physical files'}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><h2>Storage by type</h2></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Active files</th>
                    <th>Active size</th>
                    <th>Expired files</th>
                    <th>Expired size</th>
                    <th>Deleted records kept</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows(storage).map(([label, row]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{row.active_files}</td>
                      <td>{formatBytes(row.active_bytes)}</td>
                      <td>{row.expired_files}</td>
                      <td>{formatBytes(row.expired_bytes)}</td>
                      <td>{row.deleted_records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {message && !storage ? <EmptyState title="Could not load storage" text={message} /> : null}
    </>
  );
}
