import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatLkr, serviceLabel } from '../../utils/format';

export default function AdminRevenue() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadRevenue = useCallback(() => {
    return apiRequest('/admin/revenue-summary')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);
  useAutoRefresh(loadRevenue);

  if (error) return <EmptyState title="Could not load revenue" text={error} />;
  if (!data) return <div className="screen-loader">Loading revenue...</div>;

  return (
    <>
      <PageHeader title="Revenue Summary" eyebrow="paid Phase 1 orders" />
      <section className="stats-grid">
        <StatCard label="Paid orders" value={data.summary.total_orders} />
        <StatCard label="Paid revenue" value={formatLkr(data.summary.total_revenue_lkr)} />
        <StatCard label="Completed revenue" value={formatLkr(data.summary.completed_revenue_lkr)} />
      </section>

      <section className="split-grid">
        <div className="panel">
          <div className="panel-header"><h2>By service</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Orders</th>
                  <th>Files</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.by_service.map((row) => (
                  <tr key={row.service_type}>
                    <td>{serviceLabel(row.service_type)}</td>
                    <td>{row.order_count}</td>
                    <td>{row.file_count}</td>
                    <td>{formatLkr(row.revenue_lkr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>By status</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {data.by_status.map((row) => (
                  <tr key={row.order_status}>
                    <td>{row.order_status.replaceAll('_', ' ')}</td>
                    <td>{row.order_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
