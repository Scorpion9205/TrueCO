import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from '@/components/brand/logo';
import { Button } from './button';

describe('Button', () => {
  it('does not submit forms unless asked to', () => {
    render(
      <>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('styles its child instead of rendering a button when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/login">Sign in</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/login');
    expect(link).not.toHaveAttribute('type');
    expect(link.className).toContain('bg-primary');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets callers override classes', () => {
    render(<Button className="h-14">Big</Button>);
    const button = screen.getByRole('button', { name: 'Big' });
    expect(button.className).toContain('h-14');
    expect(button.className).not.toContain('h-11');
  });
});

describe('Logo', () => {
  it('links home with an accessible name', () => {
    render(<Logo />);
    expect(screen.getByRole('link', { name: 'TrueCO home' })).toHaveAttribute('href', '/');
  });

  it('can render without a link', () => {
    render(<Logo href={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('CO')).toHaveClass('text-brand');
  });
});
