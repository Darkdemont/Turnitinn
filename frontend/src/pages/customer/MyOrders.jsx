import { PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatLkr, serviceLabel } from '../../utils/format';

export default function CustomerMyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/customer/orders')
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err.message));
  }, []);

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

      <section className="panel">
        {error ? <EmptyState title="Could not load orders" text={error} /> : null}
        {!orders && !error ? <div className="screen-loader">Loading orders...</div> : null}
        {orders?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Reports</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="text-link" to={`/customer/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>{serviceLabel(order.service_type)}</td>
                    <td>{order.file_count}</td>
                    <td>{formatLkr(order.total_amount_lkr)}</td>
                    <td><StatusBadge value={order.payment_status} /></td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{order.report_count}</td>
                    <td>{formatDate(order.created_at)}</td>
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
