import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CustomerOrderList from '../../components/CustomerOrderList';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';

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
          <CustomerOrderList orders={data.recent_orders} onCancel={cancelOrder} />
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
