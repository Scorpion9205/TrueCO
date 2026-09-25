import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { ErrorView } from './error-view';

describe('ErrorView', () => {
  it('offers a retry and a way back, with a reference to quote', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    renderWithIntl(<ErrorView error={error} reset={reset} homeHref="/app" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/app');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
    // The technical detail goes to the console, not the screen
    expect(screen.queryByText('boom')).toBeNull();
  });
});
