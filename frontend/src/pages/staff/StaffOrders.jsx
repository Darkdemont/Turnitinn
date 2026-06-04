import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, serviceLabel } from '../../utils/format';

function OrdersTable({ orders }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Service</th>
            <th>Files</th>
            <th>Reports</th>
            <th>Status</th>
            <th>Accepted</th>
            <th className="table-action-heading">Action</th>
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
              <td>{serviceLabel(order.service_type)}</td>
              <td>{order.file_count}</td>
              <td>{order.report_count || 0}/2</td>
              <td><StatusBadge value={order.order_status} /></td>
              <td>{formatDate(order.accepted_at)}</td>
              <td className="table-action-cell">
                <Link className="table-action-button" to={`/staff/orders/${order.id}`}>
                  Open work
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StaffOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/staff/orders/my')
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err.message));
  }, []);

  const activeOrders = orders?.filter((order) => order.order_status !== 'completed') || [];
  const completedOrders = orders?.filter((order) => order.order_status === 'completed') || [];

  return (
    <>
      <PageHeader title="My Orders" eyebrow="accepted work" />
      <section className="panel">
        <div className="panel-header"><h2>Active orders</h2></div>
        {error ? <EmptyState title="Could not load orders" text={error} /> : null}
        {!orders && !error ? <div className="screen-loader">Loading orders...</div> : null}
        {activeOrders.length ? <OrdersTable orders={activeOrders} /> : null}
        {orders && !orders.length ? (
          <EmptyState title="No accepted orders" text="Use Available Orders to accept work first." />
        ) : null}
        {orders?.length && !activeOrders.length ? (
          <EmptyState title="No active orders" text="Completed work is listed below." />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Completed orders</h2></div>
        {completedOrders.length ? (
          <OrdersTable orders={completedOrders} />
        ) : (
          <EmptyState title="No completed orders yet" />
        )}
      </section>
    </>
  );
}
