import { notFound } from 'next/navigation';
import { ComingSoon } from '@/components/app-shell/coming-soon';
import { NAV_ITEMS } from '@/components/app-shell/nav-config';

type Params = Promise<{ section: string[] }>;

/**
 * Sections in the navigation that are not built yet. Each real page (app/app/students/page.tsx,
 * ...) takes precedence over this catch-all as it lands; unknown paths are a 404.
 */
export default async function SectionPage({ params }: { params: Params }) {
  const { section } = await params;
  const item = NAV_ITEMS.find((nav) => nav.href === `/app/${section[0]}`);
  if (!item) notFound();
  return <ComingSoon navKey={item.key} />;
}
