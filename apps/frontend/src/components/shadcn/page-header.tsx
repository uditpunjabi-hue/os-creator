import * as React from 'react';
import { cn } from '@gitroom/frontend/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 border-b border-gray-200 bg-white px-8 py-6 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-8', className)}>{children}</div>;
}

export function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50 p-4 text-sm text-purple-700">
      <span className="font-medium">Coming soon:</span> {feature} will connect to real data once the
      backend integration ships. The layout below is the production design with sample values.
    </div>
  );
}
