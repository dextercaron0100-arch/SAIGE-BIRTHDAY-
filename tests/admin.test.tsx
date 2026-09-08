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
  children_count: 3,
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
        children_count: 0,
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
  await user.type(screen.getByLabelText('Guest or family name'), 'Casey');
  await user.click(screen.getByRole('button', { name: /Create invitation/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable.',
  );
  expect(screen.getByLabelText('Guest or family name')).toHaveValue('Casey');
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
it('edits guest details and keeps the invitation token', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  const updated = {
    ...guest,
    name: 'Avery Rose',
    status: 'attending' as const,
    children_count: 4,
    message: 'Sending birthday love',
  };
  mocks.request.mockResolvedValueOnce({ guest: updated });
  await user.click(screen.getAllByRole('button', { name: 'Edit guest' })[0]);
  const dialog = screen.getByRole('dialog');
  const name = within(dialog).getByLabelText('Guest’s name');
  await user.clear(name);
  await user.type(name, updated.name);
  await user.selectOptions(
    within(dialog).getByLabelText('Response'),
    'attending',
  );
  await user.selectOptions(within(dialog).getByLabelText('Kids joining'), '4');
  await user.clear(within(dialog).getByLabelText(/^Birthday message/));
  await user.type(
    within(dialog).getByLabelText(/^Birthday message/),
    updated.message,
  );
  await user.click(
    within(dialog).getByRole('button', { name: 'Save changes' }),
  );
  expect(mocks.request).toHaveBeenLastCalledWith(
    '/api/admin/guests',
    {
      id: guest.id,
      name: updated.name,
      status: 'attending',
      childrenCount: 4,
      message: updated.message,
    },
    'organizer-session',
    'PATCH',
  );
  expect(await screen.findByText('Avery Rose')).toBeInTheDocument();
  expect(screen.getByText('Sending birthday love')).toBeInTheDocument();
  expect(updated.token).toBe(guest.token);
});
it('requires confirmation before permanently deleting a guest', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await screen.findByText('Avery');
  await user.click(screen.getAllByRole('button', { name: 'Delete guest' })[0]);
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Their personal invitation link will stop working immediately.',
  );
  await user.click(screen.getByRole('button', { name: 'Keep guest' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mocks.request).toHaveBeenCalledTimes(1);

  await user.click(screen.getAllByRole('button', { name: 'Delete guest' })[0]);
  mocks.request.mockRejectedValueOnce(new Error('Could not delete guest.'));
  await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(
    await within(screen.getByRole('dialog')).findByRole('alert'),
  ).toHaveTextContent('Could not delete guest.');

  mocks.request.mockResolvedValueOnce({ deleted: true });
  await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Invitation deleted for Avery.',
  );
  expect(screen.queryByText('Avery')).not.toBeInTheDocument();
  expect(screen.getByText('Blair')).toBeInTheDocument();
  expect(mocks.request).toHaveBeenLastCalledWith(
    '/api/admin/guests',
    { id: guest.id },
    'organizer-session',
    'DELETE',
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
