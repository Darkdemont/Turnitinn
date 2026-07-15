import { XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order_id');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!orderNumber) { setDone(true); return; }
    apiRequest('/customer/orders')
      .then(({ orders }) => {
        const found = (orders || []).find((o) => o.order_number === orderNumber);
        if (found && found.order_status === 'pending_payment') {
          return apiRequest(`/customer/orders/${found.id}/cancel`, { method: 'POST' });
        }
      })
      .catch(() => {})
      .finally(() => setDone(true));
  }, [orderNumber]);

  return (
    <div className="payment-result-page">
      <div className="payment-result-card">
        <div className="payment-result-icon">
          <XCircle size={52} style={{ color: 'var(--muted)' }} />
        </div>
        <h1>Payment cancelled</h1>
        <p>
          You cancelled the payment. No charge was made.
          You can try again whenever you are ready.
        </p>
        <div className="button-row">
          <Link className="primary-button" to="/customer/dashboard">Back to dashboard</Link>
          <Link className="ghost-button" to="/customer/orders">View orders</Link>
        </div>
      </div>
    </div>
  );
}
