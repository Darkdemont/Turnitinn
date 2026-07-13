import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { accountTypeLabel, formatDate, formatLkr, formatUsd, serviceLabel } from '../../utils/format';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(() => {
    apiRequest('/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);
  useAutoRefresh(loadDashboard);

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  const summary = data.summary;

  return (
    <>
      <PageHeader title="Admin Dashboard" eyebrow="operations" />
      <section className="stats-grid">
        <StatCard label="Orders" value={summary.total_orders} />
        <StatCard label="Customers" value={summary.total_customers} />
        <StatCard label="Staff" value={summary.total_staff} />
        <StatCard label="Wholesalers" value={summary.total_wholesalers || 0} />
        <StatCard label="Revenue" value={formatLkr(summary.total_revenue_lkr)} />
        <StatCard label="Available" value={summary.available_orders} />
        <StatCard label="Completed" value={summary.completed_orders} />
        <StatCard label="Unpaid staff earnings" value={formatUsd(summary.unpaid_staff_earnings_usd)} />
        <StatCard
          label="Wholesaler due"
          value={formatLkr(summary.unpaid_wholesaler_amount_lkr)}
          detail={`${summary.unpaid_wholesaler_files || 0} files`}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link className="text-link" to="/admin/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Account</th>
                  <th>Customer</th>
                  <th>Staff</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="text-link" to={`/admin/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>{accountTypeLabel(order.account_type)}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.staff_name || '-'}</td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{order.file_count}</td>
                    <td>{formatLkr(order.total_amount_lkr)}</td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No orders yet" />
        )}
      </section>
    </>
  );
}
