'use client';

import { Sparkles, Briefcase } from 'lucide-react';
import { useProduct, type Product } from '@gitroom/frontend/components/layout/product.context';
import { cn } from '@gitroom/frontend/lib/utils';

const options: { key: Product; label: string; icon: typeof Sparkles }[] = [
  { key: 'CONTENT', label: 'Content', icon: Sparkles },
  { key: 'MANAGER', label: 'Manager', icon: Briefcase },
];

export const ProductSwitcher = () => {
  const { product, setProduct } = useProduct();
  return (
    <div
      role="tablist"
      aria-label="Product"
      className="inline-flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white p-1"
    >
      {options.map((opt) => {
        const active = product === opt.key;
        const Icon = opt.icon;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => setProduct(opt.key)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
              active
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
