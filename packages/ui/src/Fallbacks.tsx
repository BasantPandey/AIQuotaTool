/** Fallback rendered by <ErrorBoundary> if the quota load throws. */
export function QuotaErrorFallback({ error }: { error: Error }) {
  return (
    <div className="empty error" role="alert">
      <h2>Could not load quota data</h2>
      <p>{error.message}</p>
    </div>
  );
}

/** Fallback rendered by <Suspense> while the first load is in progress. */
export function QuotaLoadingFallback() {
  return (
    <div className="empty" aria-busy="true">
      <div className="spinner" />
      <p style={{ marginTop: 12 }}>Loading…</p>
    </div>
  );
}
