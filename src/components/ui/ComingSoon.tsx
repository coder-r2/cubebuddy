interface ComingSoonProps {
  title: string;
  phase: string;
  children: React.ReactNode;
}

/** Placeholder for pages whose features land in a later phase. */
export function ComingSoon({ title, phase, children }: ComingSoonProps) {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
        Coming in {phase}
      </p>
      <div className="mt-4 space-y-2 text-muted">{children}</div>
    </section>
  );
}
