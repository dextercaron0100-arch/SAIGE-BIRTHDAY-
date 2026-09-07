// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Guest } from '../shared/types';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  request: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: mocks }),
}));
vi.mock('../src/api', () => ({ request: mocks.request }));
vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
const { default: Admin } = await import('../src/Admin');
const guest: Guest = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Avery',
  token: 'a'.repeat(64),
  status: 'attending',
  message: 'Happy birthday!',
  created_at: '',
  updated_at: '',
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'organizer-session',
        user: { id: 'organizer-id' },
      },
    },
  });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.request.mockResolvedValue({
    guests: [
      guest,
      {
        ...guest,
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Blair',
        status: 'pending',
        token: 'b'.repeat(64),
        message: '',
      },
    ],
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

it('loads guests with a bearer session and filters by search and attendance', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  expect(mocks.request).toHaveBeenCalledWith(
    '/api/admin/guests',
    undefined,
    'organizer-session',
  );
  await user.type(screen.getByLabelText('Search guests'), 'Blair');
  expect(screen.queryByText('Avery')).not.toBeInTheDocument();
  expect(screen.getByText('Blair')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Search guests'));
  await user.selectOptions(screen.getByLabelText('Response'), 'attending');
  expect(screen.getByText('Avery')).toBeInTheDocument();
  expect(screen.queryByText('Blair')).not.toBeInTheDocument();
});
it('keeps a selectable personal link visible after a copy attempt', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  await user.click(screen.getAllByRole('button', { name: 'Copy link ↗' })[0]);
  expect(screen.getByLabelText('Invitation link ready to copy')).toHaveValue(
    `${window.location.origin}/#invite=${guest.token}`,
  );
  expect(screen.getByText(/tap and hold the link/i)).toBeInTheDocument();
});
it('creates a guest only after successful storage', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  mocks.request.mockRejectedValueOnce(new Error('Service unavailable.'));
  await user.type(screen.getByLabelText('Guest’s full name'), 'Casey');
  await user.click(screen.getByRole('button', { name: /Create invitation/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable.',
  );
  expect(screen.getByLabelText('Guest’s full name')).toHaveValue('Casey');
  mocks.request.mockResolvedValueOnce({
    guest: { ...guest, id: 'new-guest', name: 'Casey' },
  });
  await user.click(screen.getByRole('button', { name: /Create invitation/ }));
  expect(await screen.findByText('Casey')).toBeInTheDocument();
  expect(mocks.request).toHaveBeenLastCalledWith(
    '/api/admin/guests',
    { name: 'Casey' },
    'organizer-session',
  );
});
it('requires confirmation to rotate, shows failures in the dialog, and preserves the RSVP', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  await user.click(screen.getAllByRole('button', { name: 'Replace link' })[0]);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Keep current link' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mocks.request).toHaveBeenCalledTimes(1);
  await user.click(screen.getAllByRole('button', { name: 'Replace link' })[0]);
  mocks.request.mockRejectedValueOnce(new Error('Could not replace the link.'));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Replace link',
    }),
  );
  expect(
    await within(screen.getByRole('dialog')).findByRole('alert'),
  ).toHaveTextContent('Could not replace the link.');
  mocks.request.mockResolvedValueOnce({
    guest: { ...guest, token: 'c'.repeat(64) },
  });
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Replace link',
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Link replaced for Avery',
  );
  expect(screen.getByText('Happy birthday!')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
