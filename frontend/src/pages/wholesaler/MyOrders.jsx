import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CustomerOrderList from '../../components/CustomerOrderList';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';

export default function WholesalerMyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    const data = await apiRequest('/wholesaler/orders');
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

  return (
    <>
      <PageHeader
        title="My Orders"
        eyebrow="wholesaler"
        actions={<Link className="primary-button" to="/wholesaler/dashboard">Submit files</Link>}
      />

      <section className="panel">
        {error ? <EmptyState title="Could not load orders" text={error} /> : null}
        {!orders && !error ? <div className="screen-loader">Loading orders...</div> : null}
        {orders?.length ? (
          <CustomerOrderList basePath="/wholesaler/orders" orders={orders} />
        ) : null}
        {orders && !orders.length ? (
          <EmptyState
            title="No wholesaler orders yet"
            text="Submitted files will appear here with report download buttons after staff complete them."
            action={<Link className="primary-button" to="/wholesaler/dashboard">Submit files</Link>}
          />
        ) : null}
      </section>
    </>
  );
}
