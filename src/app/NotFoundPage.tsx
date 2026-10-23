import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-md space-y-3 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted">That page doesn’t exist — maybe a mistyped link.</p>
      <Link to="/" className="inline-block rounded-lg bg-accent px-4 py-2 text-accent-contrast">
        Back to home
      </Link>
    </section>
  );
}
