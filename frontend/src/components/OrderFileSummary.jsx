export default function OrderFileSummary({ files = [], fallbackCount = 0 }) {
  const visibleFiles = Array.isArray(files) ? files.slice(0, 2) : [];
  const remainingCount = Math.max(0, Number(files?.length || fallbackCount || 0) - visibleFiles.length);

  if (!visibleFiles.length) {
    return <span className="muted-label">{fallbackCount || 0} file(s)</span>;
  }

  return (
    <div className="file-name-stack">
      {visibleFiles.map((file) => (
        <span key={file.id || file.original_file_name}>{file.original_file_name}</span>
      ))}
      {remainingCount ? <small>+{remainingCount} more</small> : null}
    </div>
  );
}
