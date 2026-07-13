import { Calculator, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatLkr, formatUsd } from '../../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date) {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function rangePreset(preset) {
  const today = startOfLocalDay(new Date());
  if (preset === 'yesterday') {
    const yesterday = new Date(today.getTime() - DAY_MS);
    return { from: yesterday, to: today };
  }
  if (preset === 'week') {
    return { from: new Date(today.getTime() - 6 * DAY_MS), to: endOfLocalDay(today) };
  }
  if (preset === 'month') {
    return { from: new Date(today.getTime() - 29 * DAY_MS), to: endOfLocalDay(today) };
  }
  return { from: today, to: endOfLocalDay(today) };
}

function dayLabel(value) {
  return new Intl.DateTimeFormat('en-LK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00+05:30`));
}

export default function AdminAccounting() {
  const initialRange = useMemo(() => rangePreset('today'), []);
  const [range, setRange] = useState(initialRange);
  const [fromInput, setFromInput] = useState(dateInputValue(initialRange.from));
  const [toInput, setToInput] = useState(dateInputValue(new Date(initialRange.to.getTime() - DAY_MS)));
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadAccounting = useCallback(async (nextRange = range) => {
    const params = new URLSearchParams({
      from: nextRange.from.toISOString(),
      to: nextRange.to.toISOString()
    });
    const response = await apiRequest(`/admin/accounting?${params.toString()}`);
    setData(response);
  }, [range]);

  useEffect(() => {
    loadAccounting().catch((err) => setMessage(err.message));
  }, [loadAccounting]);
  useAutoRefresh(loadAccounting);

  function applyPreset(preset) {
    const nextRange = rangePreset(preset);
    setRange(nextRange);
    setFromInput(dateInputValue(nextRange.from));
    setToInput(dateInputValue(new Date(nextRange.to.getTime() - DAY_MS)));
    setMessage('');
    loadAccounting(nextRange).catch((err) => setMessage(err.message));
  }

  function applyCustomRange(event) {
    event.preventDefault();
    const from = startOfLocalDay(new Date(`${fromInput}T00:00:00`));
    const to = endOfLocalDay(new Date(`${toInput}T00:00:00`));
    const nextRange = { from, to };
    setRange(nextRange);
    setMessage('');
    loadAccounting(nextRange).catch((err) => setMessage(err.message));
  }

  async function markStaffPaid(row) {
    if (!Number(row.unpaid_usd || 0)) return;
    const ok = window.confirm(`Mark ${row.name}'s unpaid staff balance as paid?`);
    if (!ok) return;

    setBusyId(row.staff_id);
    setMessage('');
    try {
      const result = await apiRequest(`/admin/accounting/staff/${row.staff_id}/mark-paid`, {
        method: 'POST'
      });
      await loadAccounting();
      setMessage(`Settled ${result.settlement.file_count} file(s) for ${row.name}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  async function clearWholesaler(row) {
    if (!Number(row.unpaid_lkr || 0)) return;
    const ok = window.confirm(`Clear wholesaler payment count for ${row.name}?`);
    if (!ok) return;

    setBusyId(row.wholesaler_id);
    setMessage('');
    try {
      await apiRequest(`/admin/wholesalers/${row.wholesaler_id}/clear-payment`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Cleared from Accounts Audit page.' })
      });
      await loadAccounting();
      setMessage(`Cleared wholesaler receivable for ${row.name}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  const summary = data?.summary;
  const isError = message && !message.includes('Settled') && !message.includes('Cleared');

  return (
    <>
      <PageHeader
        title="Accounts Audit"
        eyebrow="daily settlement"
        actions={
          <button className="ghost-button" onClick={() => loadAccounting().catch((err) => setMessage(err.message))} type="button">
            <RefreshCw size={18} aria-hidden="true" />
            Refresh
          </button>
        }
      />
      <FormMessage type={isError ? 'error' : 'success'}>{message}</FormMessage>

      <section className="panel accounting-toolbar">
        <div className="button-row">
          <button className="secondary-button" onClick={() => applyPreset('today')} type="button">Today</button>
          <button className="ghost-button" onClick={() => applyPreset('yesterday')} type="button">Yesterday</button>
          <button className="ghost-button" onClick={() => applyPreset('week')} type="button">Last 7 days</button>
          <button className="ghost-button" onClick={() => applyPreset('month')} type="button">Last 30 days</button>
        </div>
        <form className="date-range-form" onSubmit={applyCustomRange}>
          <label>From<input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} required /></label>
          <label>To<input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} required /></label>
          <button className="primary-button" type="submit">
            <Calculator size={18} aria-hidden="true" />
            Apply
          </button>
        </form>
      </section>

      {!data && !message ? <div className="screen-loader">Loading accounts...</div> : null}
      {data ? (
        <>
          <section className="stats-grid">
            <StatCard
              label="Customer income"
              value={formatLkr(summary.customer_income_lkr)}
              detail={`${summary.customer_paid_files} paid file(s)`}
            />
            <StatCard
              label="Checked files"
              value={summary.completed_files}
              detail={`${summary.completed_orders} completed order(s)`}
            />
            <StatCard
              label="Staff payable"
              value={formatUsd(summary.staff_payable_usd)}
              detail={`${summary.staff_unpaid_files} unpaid file(s) total`}
            />
            <StatCard
              label="Wholesaler receivable"
              value={formatLkr(summary.wholesaler_receivable_lkr)}
              detail={`${summary.wholesaler_unpaid_files} unpaid file(s) total`}
            />
          </section>

          <section className="panel settlement-panel">
            <div className="panel-header"><h2>End of day balance</h2></div>
            <div className="settlement-grid">
              <div><span>Customer payments in range</span><strong>{formatLkr(summary.customer_income_lkr)}</strong></div>
              <div><span>Wholesaler work completed</span><strong>{formatLkr(summary.wholesaler_receivable_lkr)}</strong></div>
              <div><span>Wholesaler money collected</span><strong>{formatLkr(summary.wholesaler_collected_lkr)}</strong></div>
              <div><span>Staff earned in range</span><strong>{formatUsd(summary.staff_payable_usd)}</strong></div>
              <div><span>Staff paid in range</span><strong>{formatUsd(summary.staff_paid_usd)}</strong></div>
              <div><span>Staff unpaid balance</span><strong>{formatUsd(summary.staff_unpaid_usd)}</strong></div>
            </div>
          </section>

          <section className="split-grid">
            <div className="panel">
              <div className="panel-header"><h2>Staff payable</h2></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Checked</th>
                      <th>Earned</th>
                      <th>Balance due</th>
                      <th>Paid</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staff_payables.map((row) => (
                      <tr key={row.staff_id}>
                        <td><strong>{row.name}</strong><br /><span className="muted-label">{row.email}</span></td>
                        <td>{row.period_files}</td>
                        <td>{formatUsd(row.period_usd)}</td>
                        <td>{formatUsd(row.unpaid_usd)}</td>
                        <td>{formatUsd(row.paid_usd)}</td>
                        <td>
                          <button
                            className="primary-button small"
                            disabled={busyId === row.staff_id || !Number(row.unpaid_usd || 0)}
                            onClick={() => markStaffPaid(row)}
                            type="button"
                          >
                            {busyId === row.staff_id ? 'Saving...' : 'Mark paid'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><h2>Wholesaler receivable</h2></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Wholesaler</th>
                      <th>Completed</th>
                      <th>New amount</th>
                      <th>Balance due</th>
                      <th>Collected</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wholesaler_receivables.map((row) => (
                      <tr key={row.wholesaler_id}>
                        <td><strong>{row.name}</strong><br /><span className="muted-label">{row.email}</span></td>
                        <td>{row.period_files}</td>
                        <td>{formatLkr(row.period_lkr)}</td>
                        <td>{formatLkr(row.unpaid_lkr)}</td>
                        <td>{formatLkr(row.cleared_lkr)}</td>
                        <td>
                          <button
                            className="primary-button small"
                            disabled={busyId === row.wholesaler_id || !Number(row.unpaid_lkr || 0)}
                            onClick={() => clearWholesaler(row)}
                            type="button"
                          >
                            {busyId === row.wholesaler_id ? 'Saving...' : 'Clear paid'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><h2>Daily audit</h2></div>
            {data.daily_rows.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer income</th>
                      <th>Paid files</th>
                      <th>Checked files</th>
                      <th>Staff payable</th>
                      <th>Staff paid</th>
                      <th>Wholesaler receivable</th>
                      <th>Wholesaler collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily_rows.map((row) => (
                      <tr key={row.date}>
                        <td>{dayLabel(row.date)}</td>
                        <td>{formatLkr(row.customer_revenue_lkr)}</td>
                        <td>{row.customer_paid_files}</td>
                        <td>{row.completed_files}</td>
                        <td>{formatUsd(row.staff_payable_usd)}</td>
                        <td>{formatUsd(row.staff_paid_usd)}</td>
                        <td>{formatLkr(row.wholesaler_receivable_lkr)}</td>
                        <td>{formatLkr(row.wholesaler_collected_lkr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No audit rows for this range" />
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
