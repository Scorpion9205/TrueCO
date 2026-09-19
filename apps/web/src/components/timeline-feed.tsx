import React from 'react';
import { ArrowRightLeft, CheckCircle, CreditCard, Award, Send } from 'lucide-react';

interface TimelineItem {
  id: string;
  eventType: 'BATCH_TRANSFERRED' | 'ATTENDANCE_MARKED' | 'FEE_PAID' | 'TEST_RESULT' | 'WHATSAPP_SENT';
  studentName: string;
  summary: string;
  timestamp: string;
  badge?: string;
}

const mockEvents: TimelineItem[] = [
  {
    id: 'evt-1',
    eventType: 'BATCH_TRANSFERRED',
    studentName: 'Aarav Sharma',
    summary: 'Transferred from Batch Physics Morning to Batch Physics Evening (Reason: Schedule Clash)',
    timestamp: '10 mins ago',
    badge: 'Batch Transfer',
  },
  {
    id: 'evt-2',
    eventType: 'FEE_PAID',
    studentName: 'Ananya Iyer',
    summary: 'Paid ₹7,500 for Term 2 Tuition via UPI. Receipt #REC-2026-894 generated.',
    timestamp: '25 mins ago',
    badge: 'Fees',
  },
  {
    id: 'evt-3',
    eventType: 'TEST_RESULT',
    studentName: 'Rohan Gupta',
    summary: 'Scored 94/100 (94%) in Weekly IIT-JEE Mathematics Simulation.',
    timestamp: '1 hour ago',
    badge: 'Academics',
  },
  {
    id: 'evt-4',
    eventType: 'ATTENDANCE_MARKED',
    studentName: 'Grade 12 Advanced Batch',
    summary: 'Attendance marked for 42 students. 39 Present, 3 Absent. WhatsApp alerts dispatched.',
    timestamp: '2 hours ago',
    badge: 'Attendance',
  },
  {
    id: 'evt-5',
    eventType: 'WHATSAPP_SENT',
    studentName: 'Pooja Verma (Parent)',
    summary: 'Inbound inquiry: "What are the test timings for tomorrow?" Deterministic bot answered successfully.',
    timestamp: '3 hours ago',
    badge: 'WhatsApp Bot',
  },
];

export function TimelineFeed() {
  const getIcon = (type: TimelineItem['eventType']) => {
    switch (type) {
      case 'BATCH_TRANSFERRED':
        return <ArrowRightLeft className="w-4 h-4 text-indigo-400" />;
      case 'FEE_PAID':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'TEST_RESULT':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'ATTENDANCE_MARKED':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'WHATSAPP_SENT':
        return <Send className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Live Student & Event Timeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">Asynchronous event stream normalized via EventBus subscribers</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Real-Time
        </span>
      </div>

      <div className="divide-y divide-slate-800/60">
        {mockEvents.map((event) => (
          <div key={event.id} className="py-3.5 flex items-start gap-3.5 group">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 mt-0.5 group-hover:border-slate-700 transition-colors">
              {getIcon(event.eventType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200 truncate">{event.studentName}</p>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{event.timestamp}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{event.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
