import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import type { CoachingProfile } from '@/lib/api-types';
import { __resetSessionForTests, getSession, getSessionEnd } from '@/lib/auth/session';
import { financialYearLabel, preferencesOf } from '@/lib/settings';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs, TEACHER } from '@/test/session';
import { SettingsPage } from './settings-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const profile: CoachingProfile = {
  id: 'c1',
  name: 'Sharma Classes',
  code: 'sharma-classes',
  phone: '9876543210',
  email: 'office@sharma.in',
  address: 'MG Road',
  city: 'Jaipur',
  state: null,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  subscription: { status: 'TRIALING', trialEndsAt: '2026-11-01', daysRemaining: 37, features: [] },
};

function settingsApi(config: Record<string, unknown> = { channels: { whatsappEnabled: true } }) {
  const calls: Array<{ path: string; body: unknown }> = [];
  let stored = { config, updatedAt: '2026-09-01T00:00:00.000Z' };
  server.use(
    http.get(`${API_URL}/coachings/me`, () => HttpResponse.json({ data: profile })),
    http.put(`${API_URL}/coachings/me`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ path: 'coaching', body });
      return HttpResponse.json({ data: { ...profile, ...body } });
    }),
    http.get(`${API_URL}/settings`, () => HttpResponse.json({ data: stored })),
    http.put(`${API_URL}/settings`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ path: 'settings', body });
      stored = {
        config: { ...stored.config, ...body },
        updatedAt: new Date().toISOString(),
      };
      return HttpResponse.json({ data: stored });
    }),
    // Signing out goes through the web server's own route
    http.post('*/api/auth/logout', () => HttpResponse.json({ data: {} })),
  );
  return calls;
}

describe('SettingsPage', () => {
  it('saves only the institute details that changed, clearing blanks', async () => {
    const calls = settingsApi();
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    expect(await screen.findByText('sharma-classes')).toBeInTheDocument();
    const name = await screen.findByLabelText('Institute name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Sharma Academy');
    await userEvent.clear(screen.getByLabelText(/Address/));
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        path: 'coaching',
        body: { name: 'Sharma Academy', address: null },
      }),
    );
  });

  it('shows a receipt example and saves a new prefix in capitals', async () => {
    const calls = settingsApi();
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    const prefix = await screen.findByLabelText('Receipt prefix');
    expect(prefix).toHaveValue('RCT');
    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'apx');
    expect(screen.getByText(/Receipts look like APX\/\d{4}-\d{2}\/00001/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save prefix' }));

    await waitFor(() =>
      expect(calls).toContainEqual({ path: 'settings', body: { receiptPrefix: 'APX' } }),
    );
  });

  it('rejects a prefix that would break receipt numbers', async () => {
    settingsApi();
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    const prefix = await screen.findByLabelText('Receipt prefix');
    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'A/B');
    expect(screen.getByText('Use 2 to 10 letters or digits.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save prefix' })).toBeDisabled();
  });

  it('turns automatic WhatsApp messages off', async () => {
    const calls = settingsApi();
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    const toggle = await screen.findByRole('switch', { name: 'Automatic WhatsApp messages' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(calls).toContainEqual({
        path: 'settings',
        body: { notifications: { whatsappEnabled: false } },
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Automatic WhatsApp messages' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
  });

  it('changes the password and then signs out, since every session ended', async () => {
    settingsApi();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/change-password`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { message: 'ok' } });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    await userEvent.type(await screen.findByLabelText('Current password'), 'Old@Password1');
    await userEvent.type(screen.getByLabelText('New password'), 'New@Password2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'New@Password2');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(getSession()).toBeNull());
    expect(body).toEqual({ currentPassword: 'Old@Password1', newPassword: 'New@Password2' });
    expect(getSessionEnd()).toBe('passwordChanged');
  });

  it('shows a wrong current password on its field', async () => {
    settingsApi();
    server.use(
      http.post(`${API_URL}/auth/change-password`, () =>
        HttpResponse.json({ error: { code: 'WRONG_PASSWORD', message: 'wrong' } }, { status: 400 }),
      ),
    );
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    await userEvent.type(await screen.findByLabelText('Current password'), 'guess');
    await userEvent.type(screen.getByLabelText('New password'), 'New@Password2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'New@Password2');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('The current password is not correct.')).toBeInTheDocument();
    expect(getSession()).not.toBeNull();
  });

  it('checks that the new passwords match', async () => {
    settingsApi();
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    await userEvent.type(await screen.findByLabelText('Current password'), 'Old@Password1');
    await userEvent.type(screen.getByLabelText('New password'), 'New@Password2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different@3');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('signs out everywhere after confirming', async () => {
    settingsApi();
    let called = false;
    server.use(
      http.post(`${API_URL}/auth/logout-all`, () => {
        called = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    signInAs(OWNER);
    renderWithIntl(<SettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sign out everywhere' }),
    );
    await waitFor(() => expect(getSessionEnd()).toBe('signedOutEverywhere'));
    expect(called).toBe(true);
  });

  it('gives teachers only their own account', async () => {
    settingsApi();
    signInAs(TEACHER);
    renderWithIntl(<SettingsPage />);

    expect(await screen.findByText('Your account')).toBeInTheDocument();
    expect(screen.queryByText('Institute')).toBeNull();
    expect(screen.queryByLabelText('Receipt prefix')).toBeNull();
  });

  it('shows institute details read-only to someone who cannot manage them', async () => {
    settingsApi();
    signInAs({ ...OWNER, permissions: ['settings:read'] });
    renderWithIntl(<SettingsPage />);

    expect(await screen.findByLabelText('Institute name')).toBeDisabled();
    expect(
      screen.getByText('Only the institute owner can change these details.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('switch')).toBeDisabled();
  });
});

describe('settings helpers', () => {
  it('reads preferences the way the API does', () => {
    expect(preferencesOf(undefined)).toEqual({ receiptPrefix: 'RCT', whatsappEnabled: true });
    expect(
      preferencesOf({ config: { channels: { whatsappEnabled: false } }, updatedAt: '' })
        .whatsappEnabled,
    ).toBe(false);
    expect(
      preferencesOf({ config: { receiptPrefix: 'bad prefix' }, updatedAt: '' }).receiptPrefix,
    ).toBe('RCT');
  });

  it('labels financial years', () => {
    expect(financialYearLabel('2026-09-25')).toBe('2026-27');
    expect(financialYearLabel('2027-03-31')).toBe('2026-27');
    expect(financialYearLabel('2099-04-01')).toBe('2099-00');
  });
});
