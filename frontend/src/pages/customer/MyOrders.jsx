import { PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CustomerOrderList from '../../components/CustomerOrderList';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';

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

    const intervalId = window.setInterval(() => {
      loadOrders().catch(() => {});
    }, 15000);

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
          <CustomerOrderList orders={orders} onCancel={cancelOrder} />
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
