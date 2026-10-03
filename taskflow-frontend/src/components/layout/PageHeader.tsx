import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-4 py-4 md:px-6 md:py-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-[19px] font-bold text-ink md:text-[22px]">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
