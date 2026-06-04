import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatUsd, serviceLabel } from '../../utils/format';

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/staff/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary;

  return (
    <>
      <PageHeader
        title="Staff Dashboard"
        eyebrow="queue"
        actions={
          <Link className="primary-button" to="/staff/available-orders">
            <FileText size={18} aria-hidden="true" />
            Available orders
          </Link>
        }
      />

      <section className="stats-grid">
        <StatCard label="Available orders" value={summary.available_orders} />
        <StatCard
          label="My active orders"
          value={`${summary.my_active_orders}/${summary.max_active_orders || 3}`}
          detail={`${summary.remaining_accept_slots ?? 0} slots free`}
        />
        <StatCard label="Completed orders" value={summary.my_completed_orders} />
        <StatCard label="Earnings" value={formatUsd(summary.total_earning_usd)} detail={`${summary.total_completed_files} files`} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent accepted orders</h2>
          <Link className="text-link" to="/staff/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <div className="work-card-grid">
            {data.recent_orders.map((order) => (
              <article className="work-card" key={order.id}>
                <div className="work-card-header">
                  <strong>{order.order_number}</strong>
                  <StatusBadge value={order.order_status} />
                </div>
                <dl className="work-card-details">
                  <div>
                    <dt>Service</dt>
                    <dd>{serviceLabel(order.service_type)}</dd>
                  </div>
                  <div>
                    <dt>Files</dt>
                    <dd>{order.file_count}</dd>
                  </div>
                  <div>
                    <dt>Accepted</dt>
                    <dd>{formatDate(order.accepted_at)}</dd>
                  </div>
                </dl>
                <Link className="primary-button" to={`/staff/orders/${order.id}`}>
                  Open work
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No accepted orders yet"
            text="Accept an available paid order to begin checking."
            action={<Link className="primary-button" to="/staff/available-orders">Open queue</Link>}
          />
        )}
      </section>
    </>
  );
}
