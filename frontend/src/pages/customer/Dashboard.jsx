import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import OrderFileSummary from '../../components/OrderFileSummary';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';
import ReportDownloadActions from '../../components/ReportDownloadActions';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/format';

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

  async function cancelOrder(orderId) {
    setMessage('');
    try {
      await apiRequest(`/customer/orders/${orderId}/cancel`, { method: 'PATCH' });
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

  return (
    <>
      <PageHeader
        title="Submit Documents"
        eyebrow="AI + Similarity report"
        actions={<Link className="ghost-button" to="/customer/orders">My orders</Link>}
      />

      <OrderUploadForm
        availablePackages={data.packages || []}
        onSubmitted={handleOrderSubmitted}
      />
      <FormMessage type={messageType}>{message}</FormMessage>

      <section className="panel recent-orders-panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link className="text-link" to="/customer/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <div className="table-wrap">
            <table className="customer-orders-table">
              <thead>
                <tr>
                  <th>Files</th>
                  <th>Status</th>
                  <th>Reports</th>
                  <th>Created</th>
                  <th className="table-action-heading">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <OrderFileSummary files={order.files} fallbackCount={order.file_count} />
                      <Link className="subtle-order-link" to={`/customer/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>
                      <ReportDownloadActions
                        compact
                        reports={order.reports}
                        aiScore={order.ai_score}
                        similarityScore={order.similarity_score}
                      />
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td className="table-action-cell">
                      {order.order_status === 'available' ? (
                        <button
                          className="ghost-button small-inline danger"
                          onClick={() => cancelOrder(order.id)}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : (
                        <Link className="table-action-button secondary" to={`/customer/orders/${order.id}`}>
                          Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No orders yet"
            text="Create your first testing order and it will become available to staff immediately."
            action={<Link className="primary-button" to="/customer/new-order">Create order</Link>}
          />
        )}
      </section>
    </>
  );
}
