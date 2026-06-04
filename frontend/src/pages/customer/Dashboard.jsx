import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/format';

export default function CustomerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/customer/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <EmptyState title="Could not load dashboard" text={error} />;
  if (!data) return <div className="screen-loader">Loading dashboard...</div>;

  return (
    <>
      <PageHeader
        title="Submit Documents"
        eyebrow="AI + Similarity report"
        actions={<Link className="ghost-button" to="/customer/orders">My orders</Link>}
      />

      <OrderUploadForm availablePackages={data.packages || []} />

      <section className="panel recent-orders-panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link className="text-link" to="/customer/orders">View all</Link>
        </div>
        {data.recent_orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Files</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="text-link" to={`/customer/orders/${order.id}`}>
                        {order.order_number}
                      </Link>
                    </td>
                    <td>{order.file_count}</td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
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
