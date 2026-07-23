import { CheckCircle2, Clock, FileText, Package, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CustomerOrderList from '../../components/CustomerOrderList';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import MilestoneBadge from '../../components/MilestoneBadge';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatLkr } from '../../utils/format';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="customer-stat-card">
      <div className="customer-stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{sub}</small> : null}
    </div>
  );
}

export default function CustomerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    const response = await apiRequest('/customer/dashboard');
    setData(response);
  }, []);

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
  }, [loadDashboard]);
  useAutoRefresh(loadDashboard);

  async function cancelOrder(orderId) {
    setMessage('');
    try {
      await apiRequest(`/customer/orders/${orderId}/cancel`, { method: 'POST' });
      await loadDashboard();
      setMessage('Order cancelled. Your file credit is available again.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleOrderSubmitted() {
    await loadDashboard();
  }

  const messageType = message.includes('cancelled') || message.includes('submitted') ? 'success' : 'error';

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary || {};
  const inProgress = (summary.in_progress_orders || 0) + (summary.available_orders || 0);

  return (
    <>
      <PageHeader
        title="My Dashboard"
        eyebrow="AI + Similarity checking"
        actions={<Link className="ghost-button" to="/customer/orders">All orders</Link>}
      />

      <MilestoneBadge count={data.platform_completed_reports} label="reports completed successfully on Turnit" />

      <div className="customer-stats-grid">
        <StatCard icon={<FileText size={20} />} label="Total orders" value={summary.total_orders || 0} />
        <StatCard icon={<Clock size={20} />} label="In progress" value={inProgress} sub="Awaiting report" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={summary.completed_orders || 0} />
        <StatCard icon={<TrendingUp size={20} />} label="Total spend" value={formatLkr(summary.total_spend_lkr || 0)} />
      </div>

      <OrderUploadForm
        availablePackages={data.packages || []}
        onSubmitted={handleOrderSubmitted}
      />
      <FormMessage type={messageType}>{message}</FormMessage>

      {(data.packages || []).length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <h2>File credits</h2>
            <span className="muted-label">{data.packages.length} active package(s)</span>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {data.packages.map((pkg) => (
              <div
                key={pkg.id}
                style={{
                  alignItems: 'center',
                  background: 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.18)',
                  borderRadius: '10px',
                  display: 'flex',
                  gap: '14px',
                  justifyContent: 'space-between',
                  padding: '12px 16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={18} style={{ color: 'var(--primary)' }} />
                  <div>
                    <strong>{pkg.package_number}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>AI + Similarity</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{pkg.remaining_file_count}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>files left</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel recent-orders-panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link className="text-link" to="/customer/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <CustomerOrderList orders={data.recent_orders} onCancel={cancelOrder} />
        ) : (
          <EmptyState
            title="No orders yet"
            text="Upload your first assignment and our team will check it and deliver a report within hours."
          />
        )}
      </section>
    </>
  );
}
