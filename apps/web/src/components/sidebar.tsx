'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CheckCircle2,
  CreditCard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  active?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, active: true },
  { name: 'Students', href: '#students', icon: Users, badge: '1,248' },
  { name: 'Batches', href: '#batches', icon: BookOpen, badge: '14' },
  { name: 'Attendance', href: '#attendance', icon: CheckCircle2 },
  { name: 'Fees & Payroll', href: '#fees', icon: CreditCard },
  { name: 'AI Risk Engine', href: '#risk', icon: BrainCircuit, badge: 'PRO' },
  { name: 'WhatsApp Bot', href: '#whatsapp', icon: MessageSquare, badge: 'Active' },
  { name: 'Reports', href: '#reports', icon: BarChart3 },
  { name: 'Settings', href: '#settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen fixed left-0 top-0 glass-panel border-r border-slate-800/80 flex flex-col z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              True<span className="text-emerald-400">CO</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-400">Coaching ERP</p>
          </div>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          v1.0
        </span>
      </div>

      {/* Institute Badge */}
      <div className="mx-4 my-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tenant Scope</span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <p className="text-xs font-semibold text-white truncate">Apex IIT-JEE Academy</p>
        <p className="text-[11px] text-slate-400 font-mono mt-0.5">tenant_coaching_01</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                item.active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    item.active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    item.badge === 'PRO'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : item.badge === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-slate-400">Multi-Tenancy RLS Active</span>
        </div>
      </div>
    </aside>
  );
}
