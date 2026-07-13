import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { accountTypeLabel, formatBytes, formatDate, serviceLabel } from '../../utils/format';

export default function StaffAvailableOrders() {
  const [orders, setOrders] = useState(null);
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);

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

  async function declineOrder(orderId) {
    setMessage('');
    setDecliningId(orderId);
    try {
      await apiRequest(`/staff/orders/${orderId}/decline`, { method: 'POST' });
      await loadOrders();
      setMessage('Order declined. It will not show in your queue again.');
    } catch (error) {
      setMessage(error.message);
      await loadOrders().catch(() => {});
    } finally {
      setDecliningId(null);
    }
  }

  return (
    <>
      <PageHeader title="Available Orders" eyebrow="first come first served" />
      <FormMessage type={message.includes('accepted.') || message.includes('declined') ? 'success' : 'error'}>{message}</FormMessage>

      <section className="panel">
        {!orders ? <div className="screen-loader">Loading available orders...</div> : null}
        {orders?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>File</th>
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
                    <td>
                      <div className="file-name-stack">
                        <span>
                          {order.files?.[0]?.original_file_name || `${order.file_count} file(s)`}
                          {order.has_file_warning ? (
                            <span className="status-badge warning tiny" title="Word count or language may need a closer look">
                              check
                            </span>
                          ) : null}
                        </span>
                        <small>
                          {order.files?.[0]
                            ? `${formatBytes(order.files[0].file_size)}${order.file_count > 1 ? ` first file, ${formatBytes(order.total_file_size)} total` : ''}`
                            : '-'}
                        </small>
                      </div>
                    </td>
                    <td>{accountTypeLabel(order.account_type)}</td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{order.file_count}</td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td className="button-row compact">
                      <button
                        className="primary-button small"
                        onClick={() => acceptOrder(order.id)}
                        disabled={acceptingId === order.id || decliningId === order.id}
                      >
                        <CheckCircle2 size={16} aria-hidden="true" />
                        {acceptingId === order.id ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        className="ghost-button small-inline danger"
                        onClick={() => declineOrder(order.id)}
                        disabled={acceptingId === order.id || decliningId === order.id}
                        type="button"
                      >
                        <XCircle size={16} aria-hidden="true" />
                        {decliningId === order.id ? 'Declining...' : 'Decline'}
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
