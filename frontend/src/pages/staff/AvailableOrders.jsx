import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { accountTypeLabel, formatDate, serviceLabel } from '../../utils/format';

export default function StaffAvailableOrders() {
  const [orders, setOrders] = useState(null);
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);

  const loadOrders = useCallback(async () => {
    const data = await apiRequest('/staff/orders/available');
    setOrders(data.orders);
  }, []);

  useEffect(() => {
    loadOrders().catch((err) => setMessage(err.message));
    const intervalId = window.setInterval(() => {
      loadOrders().catch(() => {});
    }, 10000);

    function refreshWhenVisible() {
      if (!document.hidden) {
        loadOrders().catch(() => {});
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [loadOrders]);

  async function acceptOrder(orderId) {
    setMessage('');
    setAcceptingId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/accept`, { method: 'POST' });
      await loadOrders();
      setMessage('Order accepted. You can now download its files from My Orders.');
    } catch (error) {
      setMessage(error.message);
      await loadOrders().catch(() => {});
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Available Orders" eyebrow="first come first served" />
      <FormMessage type={message.includes('accepted.') ? 'success' : 'error'}>{message}</FormMessage>

      <section className="panel">
        {!orders ? <div className="screen-loader">Loading available orders...</div> : null}
        {orders?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Account</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="text-link" to={`/staff/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>{accountTypeLabel(order.account_type)}</td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{order.file_count}</td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      <button
                        className="primary-button small"
                        onClick={() => acceptOrder(order.id)}
                        disabled={acceptingId === order.id}
                      >
                        <CheckCircle2 size={16} aria-hidden="true" />
                        {acceptingId === order.id ? 'Accepting...' : 'Accept'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {orders && !orders.length ? (
          <EmptyState title="No available orders" text="Paid test orders will appear here as customers create them." />
        ) : null}
      </section>
    </>
  );
}
