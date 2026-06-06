import { CheckCircle2, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatUsd, serviceLabel } from '../../utils/format';

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);

  const loadDashboard = useCallback(async () => {
    const response = await apiRequest('/staff/dashboard');
    setData(response);
  }, []);

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
  }, [loadDashboard]);

  async function acceptOrder(orderId) {
    setMessage('');
    setAcceptingId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/accept`, { method: 'POST' });
      await loadDashboard();
      setMessage('Order accepted. Open it from My active work.');
    } catch (err) {
      setMessage(err.message);
      await loadDashboard().catch(() => {});
    } finally {
      setAcceptingId(null);
    }
  }

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary;
  const availableOrders = data.available_orders || [];
  const activeOrders = data.active_orders || data.recent_orders || [];

  return (
    <>
      <PageHeader
        title="Staff Dashboard"
        eyebrow="queue"
        actions={
          <Link className="primary-button" to="/staff/available-orders">
            <FileText size={18} aria-hidden="true" />
            Full queue
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

      <FormMessage type={message.includes('accepted') ? 'success' : 'error'}>{message}</FormMessage>

      <section className="panel">
        <div className="panel-header">
          <h2>Available orders</h2>
          <Link className="text-link" to="/staff/available-orders">View all</Link>
        </div>
        {availableOrders.length ? (
          <div className="work-card-grid">
            {availableOrders.map((order) => (
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
                    <dt>Created</dt>
                    <dd>{formatDate(order.created_at)}</dd>
                  </div>
                </dl>
                <button
                  className="primary-button"
                  disabled={acceptingId === order.id || summary.remaining_accept_slots <= 0}
                  onClick={() => acceptOrder(order.id)}
                  type="button"
                >
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {acceptingId === order.id ? 'Accepting...' : 'Accept order'}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No available orders" text="New paid customer submissions will appear here." />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>My active work</h2>
          <Link className="text-link" to="/staff/orders">View all</Link>
        </div>
        {activeOrders.length ? (
          <div className="work-card-grid">
            {activeOrders.map((order) => (
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
                    <dt>Reports</dt>
                    <dd>{order.report_count || 0}/2</dd>
                  </div>
                </dl>
                <Link className="primary-button" to={`/staff/orders/${order.id}`}>
                  Open work
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No active work" text="Accepted orders stay here until completed." />
        )}
      </section>
    </>
  );
}
