import { Link } from 'react-router-dom';
import { formatDate } from '../utils/format';
import OrderFileSummary from './OrderFileSummary';
import ReportDownloadActions from './ReportDownloadActions';
import StatusBadge from './StatusBadge';

export default function CustomerOrderList({ basePath = '/customer/orders', orders = [], onCancel }) {
  return (
    <div className="customer-order-list">
      {orders.map((order) => (
        <article className="customer-order-item" key={order.id}>
          <div className="customer-order-main">
            <OrderFileSummary files={order.files} fallbackCount={order.file_count} />
            <Link className="subtle-order-link" to={`${basePath}/${order.id}`}>
              {order.order_number}
            </Link>
          </div>

          <div className="customer-order-status">
            <StatusBadge value={order.order_status} />
            <small>{formatDate(order.created_at)}</small>
          </div>

          <ReportDownloadActions
            compact
            reports={order.reports}
            aiScore={order.ai_score}
            similarityScore={order.similarity_score}
          />

          <div className="customer-order-actions">
            {order.order_status === 'available' && onCancel ? (
              <button
                className="ghost-button small-inline danger"
                onClick={() => onCancel(order.id)}
                type="button"
              >
                Cancel
              </button>
            ) : (
              <Link className="table-action-button secondary" to={`${basePath}/${order.id}`}>
                Details
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
