import { lazy, Suspense, useEffect, useState } from 'react';
import { event } from '../shared/event';
import type { Invitation, Reply } from '../shared/types';
import { request, RequestError } from './api';
import { Bow } from './Bow';
import { InvitationPage } from './Invitation';

const Admin = lazy(() => import('./Admin'));
const sample: Invitation = {
  name: 'Avery',
  status: 'pending',
  childrenCount: 0,
  message: '',
  deadline: event.rsvpDeadline,
  closed: false,
};

export function App({ token }: { token: string | null }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const preview = path === '/preview';
  const [invitation, setInvitation] = useState<Invitation | null>(
    preview ? sample : null,
  );
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    for (const [name, value] of Object.entries(event.colors))
      document.documentElement.style.setProperty(`--${name}`, value);
  }, []);
  useEffect(() => {
    if (!token || preview || path === '/admin') return;
    let active = true;
    setError('');
    request<Invitation>('/api/invitation', { token })
      .then((data) => {
        if (active) setInvitation(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load this invitation.',
          );
          setErrorStatus(err instanceof RequestError ? err.status : 0);
        }
      });
    return () => {
      active = false;
    };
  }, [token, preview, path, attempt]);
  async function save(reply: Reply) {
    if (preview) {
      const next = { ...sample, ...reply };
      setInvitation(next);
      return next;
    }
    const next = await request<Invitation>('/api/rsvp', { token, ...reply });
    setInvitation(next);
    return next;
  }
  if (path === '/admin')
    return (
      <Suspense fallback={<StateCard title="Opening organizer dashboard…" />}>
        <Admin />
      </Suspense>
    );
  if (path !== '/' && !preview)
    return (
      <StateCard
        title="This page wandered off."
        text="Please use the personal invitation link shared by the family."
      />
    );
  return (
    <>
      {preview && (
        <aside className="preview-banner">
          <span>✧ SAMPLE PREVIEW</span>
          <span>Fictional guest · Replies are not saved</span>
        </aside>
      )}
      {error ? (
        <StateCard
          title={
            errorStatus === 400 || errorStatus === 404
              ? 'Let’s find your invitation.'
              : 'A little pause before the party.'
          }
          text={error}
        >
          {errorStatus !== 400 && errorStatus !== 404 && (
            <button className="button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </StateCard>
      ) : invitation ? (
        <InvitationPage invitation={invitation} preview={preview} save={save} />
      ) : token ? (
        <StateCard
          title="Unwrapping your invitation…"
          text="Just a little moment."
        />
      ) : (
        <StateCard
          title="Something sweet is coming."
          text="To open your invitation, use the personal link shared by Valyria’s family."
        >
          <a href="/preview" className="button">
            Explore the sample invitation <span aria-hidden="true">↗</span>
          </a>
          <a className="text-link" href="/admin">
            Organizer sign in
          </a>
        </StateCard>
      )}
    </>
  );
}

export function StateCard({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="state-page">
      <div className="state-card">
        <Bow />
        <span className="eyebrow">Valyria Saige · Turns One</span>
        <h1>{title}</h1>
        {text && <p role="status">{text}</p>}
        {children}
      </div>
    </main>
  );
}
