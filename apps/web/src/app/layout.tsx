import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrueCO - WhatsApp-First Coaching ERP & Smart Analytics',
  description:
    'Next-generation institute management platform powered by WhatsApp Cloud automation, multi-tenant Clean Architecture, and AI-driven Student Risk Scoring.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0b0f17] text-slate-100 selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
