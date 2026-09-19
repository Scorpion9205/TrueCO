import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  accentColor?: 'emerald' | 'indigo' | 'amber' | 'rose';
  subtitle?: string;
}

export function KpiCard({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  accentColor = 'emerald',
  subtitle,
}: KpiCardProps) {
  const accentClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/10',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10',
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-extrabold text-white mt-2 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border shadow-lg ${accentClasses[accentColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {change && (
        <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-800/80">
          <span
            className={`inline-flex items-center text-xs font-bold ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? '↑' : '↓'} {change}
          </span>
          <span className="text-[11px] text-slate-400">vs previous month</span>
        </div>
      )}
    </div>
  );
}
