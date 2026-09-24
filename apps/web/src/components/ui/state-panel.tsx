import type { ReactNode } from 'react';

/** Centred icon, title and message for empty, error and "no access" states */
export function StatePanel({
  icon,
  title,
  children,
  role,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center"
    >
      <span className="mb-2 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="flex max-w-md flex-col items-center gap-2 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
