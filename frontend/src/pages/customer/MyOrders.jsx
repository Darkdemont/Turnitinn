import { PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import OrderFileSummary from '../../components/OrderFileSummary';
import PageHeader from '../../components/PageHeader';
import ReportDownloadActions from '../../components/ReportDownloadActions';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatLkr, serviceLabel } from '../../utils/format';

export default function CustomerMyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOrders = useCallback(async () => {
    const data = await apiRequest('/customer/orders');
    setOrders(data.orders);
  }, []);

  useEffect(() => {
    loadOrders().catch((err) => setError(err.message));
  }, [loadOrders]);

  async function cancelOrder(orderId) {
    setMessage('');
    try {
      await apiRequest(`/customer/orders/${orderId}/cancel`, { method: 'PATCH' });
      await loadOrders();
      setMessage('Order cancelled. Your file credit is available again.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="My Orders"
        eyebrow="customer"
        actions={
          <Link className="primary-button" to="/customer/new-order">
            <PlusCircle size={18} aria-hidden="true" />
            New order
          </Link>
        }
      />

      <FormMessage type={message.includes('cancelled') ? 'success' : 'error'}>{message}</FormMessage>

      <section className="panel">
        {error ? <EmptyState title="Could not load orders" text={error} /> : null}
        {!orders && !error ? <div className="screen-loader">Loading orders...</div> : null}
        {orders?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Files</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Downloads</th>
                  <th>Created</th>
                  <th className="table-action-heading">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <OrderFileSummary files={order.files} fallbackCount={order.file_count} />
                      <Link className="subtle-order-link" to={`/customer/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{formatLkr(order.total_amount_lkr)}</td>
                    <td><StatusBadge value={order.payment_status} /></td>
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
        ) : null}
        {orders && !orders.length ? (
          <EmptyState
            title="No orders yet"
            text="New testing orders are marked paid automatically in Phase 1."
            action={<Link className="primary-button" to="/customer/new-order">Create order</Link>}
          />
        ) : null}
      </section>
    </>
  );
}
