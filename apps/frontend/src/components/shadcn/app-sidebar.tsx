'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Users,
  Sparkles,
  FileText,
  Calendar as CalendarIcon,
  Settings,
  Mail,
  Briefcase,
  Wallet,
  Search,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@gitroom/frontend/lib/utils';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { useProduct } from '@gitroom/frontend/components/layout/product.context';

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[] };

const contentNav: NavSection[] = [
  {
    title: 'Research',
    items: [
      { label: 'My Profile', href: '/creator/research/profile', icon: Search },
      { label: 'Competitors', href: '/creator/research/competitors', icon: Users },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Script', href: '/creator/content/scripts', icon: FileText },
      { label: 'Create', href: '/creator/content/new', icon: Sparkles },
    ],
  },
  {
    title: 'Publish',
    items: [
      { label: 'Schedule', href: '/creator/schedule', icon: CalendarIcon },
      { label: 'Analytics', href: '/creator/analytics', icon: BarChart3 },
    ],
  },
];

const managerNav: NavSection[] = [
  {
    title: 'Pipeline',
    items: [
      { label: 'Inbox', href: '/manager/inbox', icon: Mail },
      { label: 'Deals', href: '/manager/deals', icon: Briefcase },
    ],
  },
  {
    title: 'Plan',
    items: [
      { label: 'Payments', href: '/manager/payments', icon: Wallet },
      { label: 'Schedule', href: '/manager/schedule', icon: CalendarIcon },
      { label: 'Contracts', href: '/manager/contracts', icon: FileText },
    ],
  },
  {
    title: 'Workspace',
    items: [{ label: 'Settings', href: '/manager/settings', icon: Settings }],
  },
];

export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  const { product } = useProduct();
  const sections = product === 'MANAGER' ? managerNav : contentNav;

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}
    >
      <div className="flex h-16 items-center gap-2 px-4 border-b border-gray-100">
        <div className="h-9 w-9 shrink-0">
          <Logo size={36} />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-gray-900">Illuminati</span>
            <span className="text-xs text-gray-500">
              {product === 'MANAGER' ? 'Manager · AI co-pilot' : 'Content workflow'}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                {section.title}
              </div>
            )}
            <ul className="flex flex-col gap-1 px-2">
              {section.items.map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-purple-50 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="m-3 flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
};
