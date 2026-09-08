// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { EventDetails, InvitationPage, RsvpForm } from '../src/Invitation';
import { App } from '../src/App';
import { RequestError } from '../src/api';
import { event } from '../shared/event';
import type { Invitation } from '../shared/types';

const guest: Invitation = {
  name: 'Avery',
  status: 'pending',
  message: '',
  closed: false,
  deadline: null,
};
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
});
it('preserves form input after a failed save and confirms only a successful retry', async () => {
  const user = userEvent.setup();
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Connection interrupted.'))
    .mockResolvedValueOnce({
      ...guest,
      status: 'attending',
      message: 'Happy birthday!',
    });
  render(<RsvpForm invitation={guest} preview={false} save={save} />);
  await user.click(screen.getByLabelText(/Joyfully attending/));
  await user.type(screen.getByLabelText(/A little wish/), 'Happy birthday!');
  await user.click(screen.getByRole('button', { name: /Send my RSVP/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connection interrupted.',
  );
  expect(screen.getByLabelText(/A little wish/)).toHaveValue('Happy birthday!');
  expect(
    screen.queryByText(/Your response has been saved/),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Send my RSVP/ }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Your response has been saved',
  );
  expect(save).toHaveBeenLastCalledWith({
    status: 'attending',
    message: 'Happy birthday!',
  });
});
it('restores the saved response and message', () => {
  render(
    <RsvpForm
      invitation={{ ...guest, status: 'declined', message: 'Sending love' }}
      preview={false}
      save={vi.fn()}
    />,
  );
  expect(screen.getByLabelText(/Unable to attend/)).toBeChecked();
  expect(screen.getByLabelText(/A little wish/)).toHaveValue('Sending love');
  expect(
    screen.getByRole('button', { name: /Update my response/ }),
  ).toBeEnabled();
});
it('disables a closed RSVP and retains the message after server deadline rejection', async () => {
  const user = userEvent.setup();
  render(
    <RsvpForm
      invitation={{ ...guest, status: 'attending', message: 'Love!' }}
      preview={false}
      save={vi
        .fn()
        .mockRejectedValue(
          new RequestError(409, 'The RSVP deadline has passed.'),
        )}
    />,
  );
  await user.click(screen.getByRole('button', { name: /Update my response/ }));
  expect(
    await screen.findByRole('button', { name: /RSVPs are closed/ }),
  ).toBeDisabled();
  expect(screen.getByLabelText(/A little wish/)).toHaveValue('Love!');
});
it('labels sample replies accurately without API calls', async () => {
  window.history.replaceState(null, '', '/preview');
  const fetch = vi.spyOn(globalThis, 'fetch');
  const user = userEvent.setup();
  render(<App token={null} />);
  expect(screen.getByText('✧ SAMPLE PREVIEW')).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', {
      name: 'Open the envelope addressed to Avery',
    }),
  );
  await user.click(
    await screen.findByRole('button', { name: /Open Invitation/ }),
  );
  await user.click(screen.getByLabelText(/Joyfully attending/));
  await user.click(screen.getByRole('button', { name: /Try sample response/ }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Nothing was saved to a database.',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('shows configured event details and photos while hiding unavailable directions', async () => {
  const user = userEvent.setup();
  render(<InvitationPage invitation={guest} preview={false} save={vi.fn()} />);
  await user.click(
    screen.getByRole('button', {
      name: 'Open the envelope addressed to Avery',
    }),
  );
  await user.click(
    await screen.findByRole('button', { name: /Open Invitation/ }),
  );
  expect(screen.getByText('6:00 PM – 8:00 PM')).toBeInTheDocument();
  expect(screen.getByText('JOLLIBEE CROSSING')).toBeInTheDocument();
  expect(screen.getByText('Friday, September 11, 2026')).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: /Get directions/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('img', {
      name: 'Valyria sitting in a pink birthday portrait setting',
    }),
  ).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Next photo' }));
  expect(
    screen.getByRole('img', {
      name: 'Valyria dressed as a mermaid in an under-the-sea portrait setting',
    }),
  ).toBeInTheDocument();
  expect(screen.getByText('Photo 2 of 5')).toBeInTheDocument();
});
it('shows configured time, countdown and directions', () => {
  render(
    <EventDetails
      config={{
        ...event,
        startsAt: '2099-09-11T14:00:00+08:00',
        endsAt: '2099-09-11T16:00:00+08:00',
        venue: 'Garden Hall',
        mapUrl: 'https://maps.google.com/',
      }}
    />,
  );
  expect(screen.getByText('2:00 PM – 4:00 PM')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Get directions/ })).toHaveAttribute(
    'href',
    'https://maps.google.com/',
  );
  expect(screen.getByLabelText(/Time until/)).toBeInTheDocument();
});
it('shows configuration failures on real invitations without sample fallback', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ error: 'Invitations are not connected yet.' }),
      { status: 503 },
    ),
  );
  render(<App token={'a'.repeat(64)} />);
  expect(
    await screen.findByText('Invitations are not connected yet.'),
  ).toBeInTheDocument();
  expect(screen.queryByText('✧ SAMPLE PREVIEW')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
