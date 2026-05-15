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
      className="inline-flex h-8 items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5 lg:h-9 lg:gap-1 lg:p-1"
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
            // Mobile keeps the chip compact (icon + label, 26px tall) so the
            // header stays single-row. Desktop matches the older spec.
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors lg:gap-1.5 lg:px-3 lg:text-xs',
              active
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
