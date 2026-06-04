import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { formatDate, formatUsd, serviceLabel } from '../../utils/format';

export default function StaffEarnings() {
  const [dashboard, setDashboard] = useState(null);
  const [completed, setCompleted] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiRequest('/staff/dashboard'), apiRequest('/staff/orders/completed')])
      .then(([dashboardData, completedData]) => {
        setDashboard(dashboardData);
        setCompleted(completedData.orders);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <EmptyState title="Could not load earnings" text={error} />;
  if (!dashboard || !completed) return <div className="screen-loader">Loading earnings...</div>;

  return (
    <>
      <PageHeader title="Earnings" eyebrow="USD 0.55 per completed file" />
      <section className="stats-grid">
        <StatCard label="Completed files" value={dashboard.summary.total_completed_files} />
        <StatCard label="Total earnings" value={formatUsd(dashboard.summary.total_earning_usd)} />
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Completed orders</h2></div>
        {completed.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Earning</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{order.file_count}</td>
                    <td>{formatUsd(order.total_earning_usd)}</td>
                    <td>{formatDate(order.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No completed earnings yet" text="Completed orders will be listed here." />
        )}
      </section>
    </>
  );
}
