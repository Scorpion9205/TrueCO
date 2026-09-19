import React from 'react';
import { Sidebar } from '../components/sidebar';
import { KpiCard } from '../components/kpi-card';
import { TimelineFeed } from '../components/timeline-feed';
import {
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Send,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0b0f17] flex">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {/* Top Bar */}
        <header className="flex items-center justify-between pb-6 border-b border-slate-800/80 mb-8">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              Institute Dashboard
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Overview
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Apex IIT-JEE Academy • Academic Year 2026-2027 • Clean Architecture Multi-Tenant
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 transition flex items-center gap-2 shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Export Report
            </button>
            <button className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition flex items-center gap-2 shadow-lg shadow-emerald-600/20">
              <PlusCircle className="w-4 h-4" />
              Enroll Student
            </button>
          </div>
        </header>

        {/* WhatsApp Health Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                WhatsApp Cloud API & AI Bot Active
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Meta Cloud API v20.0 • 99.8% 24h delivery rate • Deterministic Parent Inquiries Enabled
              </p>
            </div>
          </div>
          <button className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            Broadcast Notification
          </button>
        </div>

        {/* Primary KPI Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <KpiCard
            title="Total Students"
            value="1,248"
            change="12.4%"
            isPositive={true}
            icon={Users}
            accentColor="emerald"
            subtitle="Across 14 active batches"
          />
          <KpiCard
            title="Fee Collections"
            value="₹18,40,000"
            change="8.2%"
            isPositive={true}
            icon={CreditCard}
            accentColor="indigo"
            subtitle="This billing month"
          />
          <KpiCard
            title="Attendance Rate"
            value="93.2%"
            change="2.1%"
            isPositive={true}
            icon={CheckCircle2}
            accentColor="emerald"
            subtitle="Last 30 days overall"
          />
          <KpiCard
            title="Students at Risk"
            value="14"
            change="3 new"
            isPositive={false}
            icon={AlertTriangle}
            accentColor="rose"
            subtitle="Scored by AI Risk Engine"
          />
        </section>

        {/* Two-Column Domain Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: AI Risk Watchlist */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">AI Student Risk Watchlist</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Flagged using attendance drops, test regression & fee overdue signals
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  14 Critical
                </span>
              </div>

              {/* Watchlist Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 font-semibold">Student</th>
                      <th className="pb-3 font-semibold">Batch</th>
                      <th className="pb-3 font-semibold">Attendance</th>
                      <th className="pb-3 font-semibold">Test Avg</th>
                      <th className="pb-3 font-semibold text-right">Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr className="group hover:bg-slate-800/30 transition">
                      <td className="py-3 font-semibold text-slate-200">Kabir Joshi</td>
                      <td className="py-3 text-slate-400">JEE Physics A</td>
                      <td className="py-3 text-rose-400 font-bold">58%</td>
                      <td className="py-3 text-amber-400 font-bold">42%</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          HIGH (Score: 84)
                        </span>
                      </td>
                    </tr>
                    <tr className="group hover:bg-slate-800/30 transition">
                      <td className="py-3 font-semibold text-slate-200">Sneha Kulkarni</td>
                      <td className="py-3 text-slate-400">NEET Bio Elite</td>
                      <td className="py-3 text-rose-400 font-bold">64%</td>
                      <td className="py-3 text-slate-300 font-bold">78%</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          HIGH (Score: 76)
                        </span>
                      </td>
                    </tr>
                    <tr className="group hover:bg-slate-800/30 transition">
                      <td className="py-3 font-semibold text-slate-200">Devansh Rawat</td>
                      <td className="py-3 text-slate-400">JEE Chem Morning</td>
                      <td className="py-3 text-amber-400 font-bold">71%</td>
                      <td className="py-3 text-rose-400 font-bold">39%</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          MEDIUM (Score: 62)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Live Event Timeline */}
          <div className="lg:col-span-5">
            <TimelineFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
