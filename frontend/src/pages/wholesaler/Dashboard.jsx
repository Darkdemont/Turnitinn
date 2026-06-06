import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CustomerOrderList from '../../components/CustomerOrderList';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import WholesalerUploadForm from '../../components/WholesalerUploadForm';
import { formatLkr } from '../../utils/format';

export default function WholesalerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    const response = await apiRequest('/wholesaler/dashboard');
    setData(response);
  }, []);

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));

    const intervalId = window.setInterval(() => {
      loadDashboard().catch(() => {});
    }, 15000);

    function refreshWhenVisible() {
      if (!document.hidden) {
        loadDashboard().catch(() => {});
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [loadDashboard]);

  async function handleOrderSubmitted() {
    await loadDashboard();
  }

  if (error) return <EmptyState title="Could not load wholesaler dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary;

  return (
    <>
      <PageHeader
        title="Wholesaler Dashboard"
        eyebrow="bulk submissions"
        actions={<Link className="ghost-button" to="/wholesaler/orders">My orders</Link>}
      />

      <section className="stats-grid">
        <StatCard label="Submitted files" value={summary.submitted_file_count} detail={`${summary.total_orders} orders`} />
        <StatCard label="In progress" value={summary.in_progress_orders} detail={`${summary.available_orders} waiting`} />
        <StatCard label="Completed files" value={summary.completed_file_count} />
        <StatCard
          label="Unpaid completed"
          value={summary.unpaid_completed_file_count}
          detail={formatLkr(summary.unpaid_amount_lkr)}
        />
      </section>

      <section className="wholesaler-dashboard-grid">
        <WholesalerUploadForm onSubmitted={handleOrderSubmitted} />
        <aside className="panel wholesaler-billing-panel">
          <div className="panel-header"><h2>Billing count</h2></div>
          <dl className="detail-list">
            <div><dt>Rate per file</dt><dd>{formatLkr(summary.rate_per_file_lkr)}</dd></div>
            <div><dt>Ready to pay</dt><dd>{summary.unpaid_completed_file_count} completed file(s)</dd></div>
            <div><dt>Current amount</dt><dd>{formatLkr(summary.unpaid_amount_lkr)}</dd></div>
          </dl>
          <p className="muted-copy">
            Admin clears this count after your bulk payment is settled.
          </p>
        </aside>
      </section>

      <section className="panel recent-orders-panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link className="text-link" to="/wholesaler/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <CustomerOrderList basePath="/wholesaler/orders" orders={data.recent_orders} />
        ) : (
          <EmptyState title="No wholesaler orders yet" text="Upload files and staff will see them in the available queue." />
        )}
      </section>
    </>
  );
}
