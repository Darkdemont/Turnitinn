import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatLkr } from '../../utils/format';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/admin/customers')
      .then((data) => setCustomers(data.customers))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Customers" eyebrow="accounts" />
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
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone || '-'}</td>
                    <td><StatusBadge value={customer.status} /></td>
                    <td>{customer.order_count}</td>
                    <td>{formatLkr(customer.total_spend_lkr)}</td>
                    <td>{formatDate(customer.created_at)}</td>
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
