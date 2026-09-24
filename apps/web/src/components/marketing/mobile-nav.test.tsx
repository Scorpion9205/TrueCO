import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { MobileNav } from './mobile-nav';

describe('MobileNav', () => {
  it('opens the menu and closes it after a link is chosen', async () => {
    renderWithIntl(<MobileNav showPricing />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/#pricing');

    await userEvent.click(screen.getByRole('link', { name: 'Features' }));
    expect(dialog).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderWithIntl(<MobileNav showPricing />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves Pricing out when there are no plans', async () => {
    renderWithIntl(<MobileNav showPricing={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull();
  });
});
