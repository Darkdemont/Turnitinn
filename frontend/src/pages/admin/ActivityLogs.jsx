import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate } from '../../utils/format';

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  const loadLogs = useCallback(() => {
    return apiRequest('/admin/activity-logs')
      .then((data) => setLogs(data.activity_logs))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);
  useAutoRefresh(loadLogs);

  return (
    <>
      <PageHeader title="Activity Logs" eyebrow="latest 200" />
      <section className="panel">
        {error ? <EmptyState title="Could not load logs" text={error} /> : null}
        {!logs && !error ? <div className="screen-loader">Loading logs...</div> : null}
        {logs?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Order</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.user_email || '-'}</td>
                    <td>{log.user_role || '-'}</td>
                    <td>{log.order_number || '-'}</td>
                    <td>{log.action}</td>
                    <td>{log.description}</td>
                    <td>{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {logs && !logs.length ? <EmptyState title="No activity logs yet" /> : null}
      </section>
    </>
  );
}
