/** In-page sections of the home page; "pricing" is listed only when plans are available */
export type NavKey = 'features' | 'howItWorks' | 'pricing';

export const NAV_LINKS: ReadonlyArray<{ key: NavKey; href: string }> = [
  { key: 'features', href: '/#features' },
  { key: 'howItWorks', href: '/#how-it-works' },
  { key: 'pricing', href: '/#pricing' },
];

export function visibleNavLinks(showPricing: boolean) {
  return NAV_LINKS.filter((link) => showPricing || link.key !== 'pricing');
}
