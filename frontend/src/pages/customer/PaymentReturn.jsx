import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [status, setStatus] = useState('loading');
  const [order, setOrder] = useState(null);

  const checkStatus = useCallback(async () => {
    if (!orderId) {
      setStatus('unknown');
      return;
    }
    try {
      const orders = await apiRequest('/customer/orders');
      const found = (orders.orders || []).find((o) => o.order_number === orderId);
      if (!found) {
        setStatus('unknown');
        return;
      }
      setOrder(found);
      if (found.payment_status === 'paid' && found.order_status !== 'pending_payment') {
        setStatus('paid');
      } else if (found.payment_status === 'failed' || found.order_status === 'cancelled') {
        setStatus('failed');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('unknown');
    }
  }, [orderId]);

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 5000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  if (status === 'loading') {
    return (
      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className="payment-result-icon">
            <Clock size={52} style={{ color: 'var(--info)' }} />
          </div>
          <h1>Checking payment...</h1>
          <p>Please wait while we confirm your payment status.</p>
        </div>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className="payment-result-icon">
            <CheckCircle2 size={52} style={{ color: 'var(--success)' }} />
          </div>
          <h1>Payment confirmed!</h1>
          <p>
            Your order <strong>{order?.order_number}</strong> has been submitted and is now available
            for our team to check. You will receive your report shortly.
          </p>
          <div className="button-row">
            <Link className="primary-button" to="/customer/dashboard">Go to dashboard</Link>
            <Link className="ghost-button" to="/customer/orders">View all orders</Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className="payment-result-icon">
            <XCircle size={52} style={{ color: 'var(--danger)' }} />
          </div>
          <h1>Payment failed</h1>
          <p>Your payment could not be processed. Your files have been saved but the order was not submitted. Please try again.</p>
          <div className="button-row">
            <Link className="primary-button" to="/customer/dashboard">Try again</Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className="payment-result-icon">
            <Clock size={52} style={{ color: 'var(--warning)' }} />
          </div>
          <h1>Payment processing</h1>
          <p>
            Your payment for order <strong>{order?.order_number}</strong> is being processed.
            This page will update automatically. Please do not close this tab.
          </p>
          <p style={{ fontSize: '0.88rem' }}>If this takes more than a few minutes, contact support with your order number.</p>
          <div className="button-row">
            <Link className="ghost-button" to="/customer/orders">View orders</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="payment-result-card">
        <div className="payment-result-icon">
          <CheckCircle2 size={52} style={{ color: 'var(--primary)' }} />
        </div>
        <h1>Thank you!</h1>
        <p>Your payment has been received. Please check your orders for the latest status.</p>
        <div className="button-row">
          <Link className="primary-button" to="/customer/dashboard">Go to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
