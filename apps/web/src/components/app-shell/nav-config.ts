import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  ReceiptIndianRupee,
  Settings,
  Users,
  Wallet,
  Banknote,
} from 'lucide-react';

export type NavKey =
  | 'dashboard'
  | 'students'
  | 'batches'
  | 'attendance'
  | 'tests'
  | 'homework'
  | 'fees'
  | 'expenses'
  | 'salary'
  | 'teachers'
  | 'notices'
  | 'reports'
  | 'settings'
  | 'billing';

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Shown only to users with this permission (the API enforces it regardless) */
  permission?: string;
}

export interface NavGroup {
  key: 'overview' | 'academics' | 'money' | 'institute' | 'account';
  items: NavItem[];
}

/** The app's sections. Adding a page = adding it here; the sidebar and mobile menu follow. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', href: '/app', icon: LayoutDashboard }],
  },
  {
    key: 'academics',
    items: [
      { key: 'students', href: '/app/students', icon: Users, permission: 'students:read' },
      { key: 'batches', href: '/app/batches', icon: Layers, permission: 'batches:read' },
      {
        key: 'attendance',
        href: '/app/attendance',
        icon: CalendarCheck,
        permission: 'attendance:read',
      },
      { key: 'tests', href: '/app/tests', icon: ClipboardCheck, permission: 'tests:read' },
      { key: 'homework', href: '/app/homework', icon: BookOpen, permission: 'homework:read' },
    ],
  },
  {
    key: 'money',
    items: [
      { key: 'fees', href: '/app/fees', icon: ReceiptIndianRupee, permission: 'fees:read' },
      { key: 'expenses', href: '/app/expenses', icon: Wallet, permission: 'expenses:read' },
      { key: 'salary', href: '/app/salary', icon: Banknote, permission: 'salary:read' },
    ],
  },
  {
    key: 'institute',
    items: [
      { key: 'teachers', href: '/app/teachers', icon: GraduationCap, permission: 'teachers:read' },
      { key: 'notices', href: '/app/notices', icon: Megaphone, permission: 'notices:read' },
      { key: 'reports', href: '/app/reports', icon: BarChart3, permission: 'reports:read' },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'settings', href: '/app/settings', icon: Settings, permission: 'settings:read' },
      { key: 'billing', href: '/app/billing', icon: CreditCard, permission: 'billing:read' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Groups with only the items this user may open; empty groups are dropped */
export function visibleNav(allowed: (permission: string) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || allowed(item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** The dashboard matches only itself; a section matches its own pages too (/app/students/42) */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/app') return pathname === '/app';
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The nav item for a path, e.g. the section of /app/students/42 */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isActive(item, pathname));
}
