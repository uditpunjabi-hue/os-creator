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
  { label: 'Profile', href: '/creator/research/profile', icon: Search, match: (p) => p.startsWith('/creator/research') },
  { label: 'Script', href: '/creator/content/scripts', icon: FileText, match: (p) => p.startsWith('/creator/content/scripts') },
  { label: 'Create', href: '/creator/content/new', icon: Sparkles, match: (p) => p.startsWith('/creator/content/new') },
  { label: 'Calendar', href: '/creator/schedule', icon: CalendarIcon, match: (p) => p.startsWith('/creator/schedule') },
  { label: 'Analytics', href: '/creator/analytics', icon: BarChart3, match: (p) => p.startsWith('/creator/analytics') },
];

const managerTabs: Tab[] = [
  { label: 'Inbox', href: '/manager/inbox', icon: Mail, match: (p) => p.startsWith('/manager/inbox') },
  { label: 'Deals', href: '/manager/deals', icon: Briefcase, match: (p) => p.startsWith('/manager/deals') },
  { label: 'Projects', href: '/manager/projects', icon: Wallet, match: (p) => p.startsWith('/manager/projects') || p.startsWith('/manager/payments') || p.startsWith('/manager/commercials') || p.startsWith('/manager/contracts') },
  { label: 'Calendar', href: '/manager/schedule', icon: CalendarIcon, match: (p) => p.startsWith('/manager/schedule') },
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
      // Fixed-position bottom bar — mobile only (lg:hidden). Safe-area padding
      // reserves space for the iOS home indicator so the tabs aren't overlapped
      // on notched devices.
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-gray-200 bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 64 }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
              active
                ? 'text-[#F59E0B] font-semibold'
                : 'text-gray-500 active:text-gray-900 font-medium'
            )}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            {/* Gold top-rail on the active tab — clearer "where am I" cue
                than color-only changes on tiny mobile icons. */}
            {active && (
              <span
                className="pointer-events-none absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-[#F59E0B]"
                aria-hidden="true"
              />
            )}
            <Icon
              className={cn('h-6 w-6', active && 'stroke-[2.5]')}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className="text-[11px] leading-none tracking-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
