
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, LayoutGrid, BarChart3, Users, Settings, Landmark, ArrowLeftRight, Building, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '../logo';

const mainNavItems = [
  {
    href: '/dashboard',
    icon: LayoutGrid,
    label: 'Dashboard',
  },
  {
    href: '/dashboard/wholesale',
    icon: Building,
    label: 'Wholesale',
  },
  {
    href: '/dashboard/retail',
    icon: Store,
    label: 'Retail',
  },
  {
    href: '/dashboard/inventory',
    icon: Boxes,
    label: 'Inventory',
  },
  {
    href: '/dashboard/invoices',
    icon: BarChart3,
    label: 'Invoices',
  },
  {
    href: '/dashboard/customers',
    icon: Users,
    label: 'Customers',
  },
  {
    href: '/dashboard/finance',
    icon: Landmark,
    label: 'Finance',
  },
  {
    href: '/dashboard/refund-exchange',
    icon: ArrowLeftRight,
    label: 'Refund & Exchange',
  }
];

const settingsNavItem = {
    href: '/dashboard/settings',
    icon: Settings,
    label: 'Settings',
};

interface MainSidebarProps {
  isCollapsed: boolean;
}

export function MainSidebar({ isCollapsed }: MainSidebarProps) {
  const pathname = usePathname();

  const renderNavItem = (item: typeof mainNavItems[0]) => {
    const isActive = pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard');
    return (
        <Link href={item.href} key={item.href} passHref>
          <div
            className={cn(
              'flex items-center p-3 rounded-lg cursor-pointer transition-colors',
              isCollapsed ? 'justify-center' : '',
              isActive
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800'
            )}
            title={item.label}
          >
            <item.icon className="h-7 w-7 shrink-0" />
            {!isCollapsed && <span className="ml-4 font-medium">{item.label}</span>}
          </div>
        </Link>
    );
  }

  return (
    <aside
      className={cn(
        'bg-slate-900 text-gray-200 flex flex-col transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex items-center h-20 border-b border-slate-800 flex-shrink-0 px-4">
        <Logo isCollapsed={isCollapsed} />
      </div>
      <div className="flex-1 flex flex-col justify-between py-4">
        <nav className="flex-1 px-4 space-y-2">
            {mainNavItems.map(renderNavItem)}
        </nav>
        <div className="px-4">
            {renderNavItem(settingsNavItem)}
        </div>
      </div>
    </aside>
  );
}
