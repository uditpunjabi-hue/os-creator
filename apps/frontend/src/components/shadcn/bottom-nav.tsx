'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  FileText,
  Sparkles,
  Calendar as CalendarIcon,
  BarChart3,
  Mail,
  Briefcase,
  Wallet,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@gitroom/frontend/lib/utils';
import { useProduct, type Product } from '@gitroom/frontend/components/layout/product.context';

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const contentTabs: Tab[] = [
  { label: 'Research', href: '/creator/research/profile', icon: Search, match: (p) => p.startsWith('/creator/research') },
  { label: 'Script', href: '/creator/content/scripts', icon: FileText, match: (p) => p.startsWith('/creator/content/scripts') },
  { label: 'Create', href: '/creator/content/new', icon: Sparkles, match: (p) => p.startsWith('/creator/content/new') },
  { label: 'Schedule', href: '/creator/schedule', icon: CalendarIcon, match: (p) => p.startsWith('/creator/schedule') },
  { label: 'Analytics', href: '/creator/analytics', icon: BarChart3, match: (p) => p.startsWith('/creator/analytics') },
];

const managerTabs: Tab[] = [
  { label: 'Inbox', href: '/manager/inbox', icon: Mail, match: (p) => p.startsWith('/manager/inbox') },
  { label: 'Deals', href: '/manager/deals', icon: Briefcase, match: (p) => p.startsWith('/manager/deals') },
  { label: 'Payments', href: '/manager/payments', icon: Wallet, match: (p) => p.startsWith('/manager/payments') || p.startsWith('/manager/commercials') },
  { label: 'Schedule', href: '/manager/schedule', icon: CalendarIcon, match: (p) => p.startsWith('/manager/schedule') },
  { label: 'Settings', href: '/manager/settings', icon: Settings, match: (p) => p.startsWith('/manager/settings') },
];

const tabsByProduct: Record<Product, Tab[]> = {
  CONTENT: contentTabs,
  MANAGER: managerTabs,
};

export const BottomNav: React.FC = () => {
  const pathname = usePathname() ?? '';
  const { product } = useProduct();
  const tabs = tabsByProduct[product];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex h-[64px] items-stretch border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
              'min-h-[44px]',
              active
                ? 'text-[#F59E0B] font-semibold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            )}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              className={cn('h-6 w-6', active && 'stroke-[2.5]')}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className="text-[11px] leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
