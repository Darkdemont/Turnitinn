import { ArrowLeft, CheckCircle2, CreditCard, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatLkr } from '../../utils/format';

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [creditsInput, setCreditsInput] = useState('');
  const [creditNote, setCreditNote] = useState('');

  const load = useCallback(async () => {
    const res = await apiRequest(`/admin/customers/${id}`);
    setData(res);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function updateStatus(newStatus) {
    setBusy('status');
    setMessage('');
    try {
      await apiRequest(`/admin/customers/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
        headers: { 'Content-Type': 'application/json' }
      });
      await load();
      setMessage(`Account set to ${newStatus}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  async function addCredits(event) {
    event.preventDefault();
    const count = Number(creditsInput);
    if (!count || count < 1) return;
    setBusy('credits');
    setMessage('');
    try {
      await apiRequest(`/admin/customers/${id}/add-credits`, {
        method: 'POST',
        body: JSON.stringify({ file_count: count, note: creditNote }),
        headers: { 'Content-Type': 'application/json' }
      });
      await load();
      setCreditsInput('');
      setCreditNote('');
      setMessage(`${count} file credit(s) added successfully.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  async function markOrderPaid(orderId) {
    if (!window.confirm('Mark this order as paid and make it available to staff?')) return;
    setBusy(`order-${orderId}`);
    setMessage('');
    try {
      await apiRequest(`/admin/customers/${id}/orders/${orderId}/mark-paid`, { method: 'POST' });
      await load();
      setMessage('Order marked as paid and submitted to staff queue.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  async function clearData() {
    if (!window.confirm(`Clear ALL orders, files, and packages for ${data.customer.name}? This cannot be undone.`)) return;
    setBusy('clear');
    setMessage('');
    try {
      await apiRequest(`/admin/customers/${id}/clear-data`, { method: 'POST' });
      await load();
      setMessage('Customer data cleared.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  if (error) return <EmptyState title="Could not load customer" text={error} />;
  if (!data) return <div className="screen-loader">Loading customer...</div>;

  const { customer, stats, orders, packages } = data;
  const isActive = customer.status === 'active';
  const msgType = message.includes('not') || message.includes('Could') ? 'error' : 'success';

  return (
    <>
      <PageHeader
        title={customer.name}
        eyebrow="customer detail"
        actions={
          <Link className="ghost-button" to="/admin/customers">
            <ArrowLeft size={16} />
            Back to customers
          </Link>
        }
      />
      <FormMessage type={msgType}>{message}</FormMessage>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-header"><h2>Account</h2></div>
          <dl className="detail-list">
            <div><dt>Name</dt><dd><strong>{customer.name}</strong></dd></div>
            <div><dt>Email</dt><dd>{customer.email}</dd></div>
            <div><dt>Phone</dt><dd>{customer.phone || '-'}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={customer.status} /></dd></div>
            <div><dt>Joined</dt><dd>{formatDate(customer.created_at)}</dd></div>
            <div><dt>Total orders</dt><dd><strong>{stats.total_orders}</strong></dd></div>
            <div><dt>Completed</dt><dd><strong style={{ color: 'var(--success)' }}>{stats.completed_orders}</strong></dd></div>
            <div><dt>In progress</dt><dd>{stats.in_progress_orders}</dd></div>
            <div><dt>Total spend</dt><dd><strong>{formatLkr(stats.total_spend_lkr)}</strong></dd></div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Admin actions</h2></div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--muted)' }}>Account status</h3>
              <div className="button-row">
                <button
                  className="secondary-button"
                  disabled={busy === 'status' || isActive}
                  onClick={() => updateStatus('active')}
                  type="button"
                >
                  <ShieldCheck size={16} />
                  {busy === 'status' && isActive ? 'Activating...' : 'Activate account'}
                </button>
                <button
                  className="ghost-button danger"
                  disabled={busy === 'status' || !isActive}
                  onClick={() => updateStatus('inactive')}
                  type="button"
                >
                  <ShieldOff size={16} />
                  {busy === 'status' && !isActive ? 'Disabling...' : 'Disable account'}
                </button>
              </div>
            </div>

            <form className="form-stack" onSubmit={addCredits}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--muted)', margin: 0 }}>Add free file credits</h3>
              <div className="admin-action-row">
                <label>
                  Files to add
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={creditsInput}
                    onChange={(e) => setCreditsInput(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </label>
                <label>
                  Note (optional)
                  <input
                    type="text"
                    maxLength={200}
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="Reason for adding credits"
                  />
                </label>
              </div>
              <button className="secondary-button" type="submit" disabled={busy === 'credits' || !creditsInput}>
                <CreditCard size={16} />
                {busy === 'credits' ? 'Adding...' : 'Add credits'}
              </button>
            </form>

            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--danger)' }}>Danger zone</h3>
              <button
                className="ghost-button danger"
                disabled={busy === 'clear'}
                onClick={clearData}
                type="button"
              >
                <Trash2 size={16} />
                {busy === 'clear' ? 'Clearing...' : 'Clear all customer data'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Orders ({orders.length})</h2>
        </div>
        {orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
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
                    <td>AI + Similarity</td>
                    <td>{order.file_count}</td>
                    <td>{formatLkr(order.total_amount_lkr)}</td>
                    <td><StatusBadge value={order.payment_status} /></td>
                    <td><StatusBadge value={order.order_status} /></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      {order.payment_status === 'pending' && order.order_status === 'pending_payment' ? (
                        <button
                          className="ghost-button small-inline"
                          disabled={busy === `order-${order.id}`}
                          onClick={() => markOrderPaid(order.id)}
                          type="button"
                        >
                          <CheckCircle2 size={14} />
                          Mark paid
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No orders" />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Packages ({packages.length})</h2>
        </div>
        {packages.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Files</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td><strong>{pkg.package_number}</strong></td>
                    <td>{pkg.package_file_count}</td>
                    <td>{pkg.used_file_count}</td>
                    <td>{pkg.package_file_count - pkg.used_file_count}</td>
                    <td>{pkg.total_amount_lkr ? formatLkr(pkg.total_amount_lkr) : <span style={{ color: 'var(--success)' }}>Free</span>}</td>
                    <td><StatusBadge value={pkg.payment_status} /></td>
                    <td><StatusBadge value={pkg.status} /></td>
                    <td>{formatDate(pkg.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No packages" />
        )}
      </section>
    </>
  );
}
