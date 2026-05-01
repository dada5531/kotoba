export default function ReadingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold">Reading</h1>
      <p className="text-sm text-muted-foreground">
        Curated daily articles will land here once the daily-curate cron runs.
        For now use <a className="underline" href="/mine">/mine</a> to ingest
        anything you want to read.
      </p>
    </div>
  );
}
