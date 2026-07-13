import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import ReportDownloadActions from '../../components/ReportDownloadActions';
import StatusBadge from '../../components/StatusBadge';
import { formatBytes, formatDate, formatLkr, serviceLabel } from '../../utils/format';

export default function WholesalerOrderDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest(`/wholesaler/orders/${id}`)
      .then(setData)
      .catch((err) => setMessage(err.message));
  }, [id]);

  if (message && !data) return <EmptyState title="Could not load order" text={message} />;
  if (!data) return <div className="screen-loader">Loading order...</div>;

  const { order, files, reports } = data;

  return (
    <>
      <PageHeader
        title={order.order_number}
        eyebrow="wholesaler order"
        actions={<Link className="ghost-button" to="/wholesaler/orders">Back to orders</Link>}
      />
      <FormMessage type="error">{message}</FormMessage>

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header"><h2>Order</h2></div>
          <dl className="detail-list">
            <div><dt>Service</dt><dd>{serviceLabel(order.service_type)}</dd></div>
            <div><dt>Files</dt><dd>{order.file_count}</dd></div>
            <div><dt>Rate per file</dt><dd>{formatLkr(order.price_per_file_lkr)}</dd></div>
            <div><dt>Billing</dt><dd><StatusBadge value={order.wholesaler_payment_status || 'unpaid'} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={order.order_status} audience="client" /></dd></div>
            <div>
              <dt>AI score</dt>
              <dd>
                {order.ai_skipped
                  ? `Not applicable${order.ai_skip_reason ? ` — ${order.ai_skip_reason}` : ''}`
                  : order.ai_score ?? '-'}
              </dd>
            </div>
            <div><dt>Similarity score</dt><dd>{order.similarity_score ?? '-'}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(order.created_at)}</dd></div>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Reports</h2></div>
          {reports.length ? (
            <div className="file-list report-detail-list">
              <ReportDownloadActions
                reports={reports}
                aiScore={order.ai_score}
                similarityScore={order.similarity_score}
                aiSkipped={order.ai_skipped}
                aiSkipReason={order.ai_skip_reason}
              />
              {reports.map((report) => (
                <div className="file-row" key={report.id}>
                  <div>
                    <span>{report.original_file_name}</span>
                    <small>{formatBytes(report.file_size)} - {formatDate(report.uploaded_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No final reports yet" text="Reports appear here after staff upload and complete the order." />
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Uploaded files</h2></div>
        <div className="file-list">
          {files.map((file) => (
            <div className="file-row" key={file.id}>
              <span>{file.original_file_name}</span>
              <small>{formatBytes(file.file_size)} - {formatDate(file.uploaded_at)}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
