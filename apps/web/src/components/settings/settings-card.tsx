import type { ReactNode } from 'react';

/** One settings area: a heading with a short explanation, then its controls */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
