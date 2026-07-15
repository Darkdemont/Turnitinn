import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate, formatLkr } from '../../utils/format';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadCustomers = useCallback(async () => {
    const data = await apiRequest('/admin/customers');
    setCustomers(data.customers);
  }, []);

  useEffect(() => {
    loadCustomers().catch((err) => setError(err.message));
  }, [loadCustomers]);
  useAutoRefresh(loadCustomers);

  async function clearCustomerData(customer) {
    const ok = window.confirm(
      `Clear all orders, packages, files, reports, and customer history for ${customer.name}? The login will stay.`
    );
    if (!ok) return;

    setBusyId(customer.id);
    setMessage('');
    try {
      await apiRequest(`/admin/customers/${customer.id}/clear-data`, { method: 'POST' });
      await loadCustomers();
      setMessage(`Customer data cleared for ${customer.name}.`);
    } catch (clearError) {
      setMessage(clearError.message);
    } finally {
      setBusyId('');
    }
  }

  const isError = Boolean(error || message.includes('not found') || message.includes('Could'));

  return (
    <>
      <PageHeader title="Customers" eyebrow="accounts" />
      <FormMessage type={isError ? 'error' : 'success'}>{message}</FormMessage>
      <section className="panel">
        {error ? <EmptyState title="Could not load customers" text={error} /> : null}
        {!customers && !error ? <div className="screen-loader">Loading customers...</div> : null}
        {customers?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Total spend</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link className="text-link" to={`/admin/customers/${customer.id}`}>{customer.name}</Link>
                    </td>
                    <td>{customer.email}</td>
                    <td>{customer.phone || '-'}</td>
                    <td><StatusBadge value={customer.status} /></td>
                    <td>{customer.order_count}</td>
                    <td>{formatLkr(customer.total_spend_lkr)}</td>
                    <td>{formatDate(customer.created_at)}</td>
                    <td className="button-row compact">
                      <Link className="secondary-button small-inline" to={`/admin/customers/${customer.id}`}>
                        Manage
                      </Link>
                      <button
                        className="ghost-button small-inline danger"
                        disabled={busyId === customer.id || !Number(customer.order_count || 0)}
                        onClick={() => clearCustomerData(customer)}
                        type="button"
                      >
                        {busyId === customer.id ? 'Clearing...' : 'Clear data'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {customers && !customers.length ? <EmptyState title="No customers yet" /> : null}
      </section>
    </>
  );
}
