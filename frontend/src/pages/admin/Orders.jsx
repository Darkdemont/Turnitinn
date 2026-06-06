import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { accountTypeLabel, formatDate, formatLkr, serviceLabel } from '../../utils/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/admin/orders')
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Orders" eyebrow="all orders" />
      <section className="panel">
        {error ? <EmptyState title="Could not load orders" text={error} /> : null}
        {!orders && !error ? <div className="screen-loader">Loading orders...</div> : null}
        {orders?.length ? (
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
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
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
                    <td><StatusBadge value={order.payment_status} /></td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {orders && !orders.length ? <EmptyState title="No orders yet" /> : null}
      </section>
    </>
  );
}
