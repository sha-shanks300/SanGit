/**
 * Section heading for the projects list on the dashboard and public profile:
 * a title with an optional project count. The caller pairs it with a top
 * hairline rule to separate the list from the profile masthead above.
 */
export function ProjectsSectionHeading({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-headline text-ink">{title}</h2>
      {count != null && (
        <span className="font-mono text-body-sm text-ink-tertiary">
          {count} project{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
