import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';

export default function CustomerNewOrder() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    apiRequest('/customer/dashboard')
      .then((data) => setPackages(data.packages || []))
      .catch(() => setPackages([]));
  }, []);

  return (
    <>
      <PageHeader title="Upload Files" eyebrow="AI + Similarity report" />
      <OrderUploadForm availablePackages={packages} />
    </>
  );
}
