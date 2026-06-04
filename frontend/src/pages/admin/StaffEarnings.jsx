import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import { formatUsd } from '../../utils/format';

export default function AdminStaffEarnings() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/admin/staff-earnings')
      .then((data) => setRows(data.staff_earnings))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Staff Earnings" eyebrow="completed files" />
      <section className="panel">
        {error ? <EmptyState title="Could not load staff earnings" text={error} /> : null}
        {!rows && !error ? <div className="screen-loader">Loading earnings...</div> : null}
        {rows?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Email</th>
                  <th>Completed files</th>
                  <th>Total</th>
                  <th>Unpaid</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.staff_id}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.completed_file_count}</td>
                    <td>{formatUsd(row.total_earning_usd)}</td>
                    <td>{formatUsd(row.unpaid_earning_usd)}</td>
                    <td>{formatUsd(row.paid_earning_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {rows && !rows.length ? <EmptyState title="No staff earnings yet" /> : null}
      </section>
    </>
  );
}
