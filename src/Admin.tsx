import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import type { Attendance, Guest } from '../shared/types';
import { request } from './api';
import { Bow } from './Bow';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const auth =
  url && key && !url.includes('YOUR_PROJECT') && !key.startsWith('YOUR_')
    ? createClient(url, key)
    : null;

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Attendance | 'all'>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rotating, setRotating] = useState<Guest | null>(null);
  const [manualLink, setManualLink] = useState('');
  const activeUser = useRef<string | undefined>(undefined);
  activeUser.current = session?.user.id;
  useEffect(() => {
    if (!auth) {
      setReady(true);
      return;
    }
    void auth.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = auth.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
      if (!next) {
        setGuests([]);
        setLoaded(false);
        setManualLink('');
        setRotating(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function jwt() {
    const { data } = await auth!.auth.getSession();
    if (!data.session) throw new Error('Please sign in again.');
    return data.session.access_token;
  }
  async function refresh() {
    const requestedUser = session?.user.id;
    setBusy(true);
    setError('');
    try {
      const result = await request<{ guests: Guest[] }>(
        '/api/admin/guests',
        undefined,
        await jwt(),
      );
      if (activeUser.current === requestedUser) {
        setGuests(result.guests);
        setLoaded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load guests.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setGuests([]);
    setLoaded(false);
    setManualLink('');
    setRotating(null);
    if (session?.user.id) void refresh();
  }, [session?.user.id]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: issue } = await auth!.auth.signInWithPassword({
        email,
        password,
      });
      if (issue)
        throw new Error('Sign in failed. Check your email and password.');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function createGuest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { guest } = await request<{ guest: Guest }>(
        '/api/admin/guests',
        { name },
        await jwt(),
      );
      setGuests((old) => [guest, ...old]);
      setName('');
      setNotice(
        `Invitation created for ${guest.name}. Copy their personal link below.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create invitation.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function rotate() {
    if (!rotating) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { guest } = await request<{ guest: Guest }>(
        '/api/admin/rotate',
        { id: rotating.id },
        await jwt(),
      );
      setGuests((old) => old.map((g) => (g.id === guest.id ? guest : g)));
      setManualLink('');
      setRotating(null);
      setNotice(
        `Link replaced for ${guest.name}. Copy and share the new link. Their RSVP is unchanged.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to replace link.');
    } finally {
      setBusy(false);
    }
  }
  async function writeLink(link: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        return true;
      } catch {
        // Local HTTP pages can block the modern clipboard API.
      }
    }
    const text = document.createElement('textarea');
    text.value = link;
    text.setAttribute('readonly', '');
    text.style.position = 'fixed';
    text.style.opacity = '0';
    document.body.appendChild(text);
    text.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    text.remove();
    return copied;
  }
  async function copy(guest: Guest) {
    const link = `${window.location.origin}/#invite=${guest.token}`;
    setManualLink(link);
    if (await writeLink(link)) {
      setNotice(`Personal invitation link copied for ${guest.name}.`);
    } else {
      setNotice(
        'Your personal link is shown below. Tap the link field, then choose Copy.',
      );
    }
  }
  async function copyShownLink() {
    if (await writeLink(manualLink)) {
      setNotice('Personal invitation link copied.');
    } else {
      setNotice('Tap the link field, then choose Select All and Copy.');
    }
  }
  async function exportCsv() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/export', {
        headers: { Authorization: `Bearer ${await jwt()}` },
        cache: 'no-store',
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? 'Unable to export.');
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = href;
      a.download = 'valyria-rsvps.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const { error: issue } = await auth!.auth.signOut();
    if (issue) setError('Unable to sign out. Please try again.');
    else {
      setNotice('');
      setError('');
    }
  }
  if (!ready)
    return (
      <main className="state-page">
        <p role="status">Opening organizer dashboard…</p>
      </main>
    );
  if (!auth || !session)
    return (
      <main className="state-page">
        <section className="state-card login-card">
          <Bow />
          <span className="eyebrow">A little behind the scenes</span>
          <h1>Organizer sign in</h1>
          {!auth ? (
            <p role="alert">
              Organizer login is not connected yet. Add the public Supabase
              environment variables described in the README.
            </p>
          ) : (
            <form onSubmit={login}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
          <a href="/preview" className="text-link">
            View sample invitation ↗
          </a>
        </section>
      </main>
    );
  const shown = guests.filter(
    (g) =>
      g.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (filter === 'all' || g.status === filter),
  );
  return (
    <div className="admin">
      <header className="site-header">
        <a className="wordmark" href="/">
          Valyria <span>Saige</span>
          <i>♡</i>
        </a>
        <button className="text-button" onClick={() => void logout()}>
          Sign out
        </button>
      </header>
      <main className="admin-main">
        <div className="admin-title">
          <div>
            <span className="eyebrow">
              One little celebration, all our favorite people
            </span>
            <h1>The guest book</h1>
            <p>One invitation. One guest. One very special day.</p>
          </div>
          <a
            className="text-link"
            href="/preview"
            target="_blank"
            rel="noreferrer"
          >
            Preview invitation ↗
          </a>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        {manualLink && (
          <section
            className="manual-link"
            aria-label="Personal invitation link"
          >
            <div className="manual-link-heading">
              <strong>Personal invitation link</strong>
              <button
                type="button"
                className="manual-link-close"
                onClick={() => setManualLink('')}
                aria-label="Close invitation link"
              >
                ×
              </button>
            </div>
            <div className="manual-link-actions">
              <input
                aria-label="Invitation link ready to copy"
                readOnly
                value={manualLink}
                onClick={(e) => e.currentTarget.select()}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="button"
                onClick={() => void copyShownLink()}
              >
                Copy link
              </button>
            </div>
            <small>
              On a phone, tap and hold the link if copying is blocked.
            </small>
          </section>
        )}
        <div className="totals">
          {(['invited', 'attending', 'pending', 'declined'] as const).map(
            (status) => (
              <div key={status}>
                <span>{status}</span>
                <strong>
                  {loaded
                    ? status === 'invited'
                      ? guests.length
                      : guests.filter((g) => g.status === status).length
                    : '—'}
                </strong>
                <small>
                  {status === 'attending'
                    ? 'reserved attending seats'
                    : status === 'invited'
                      ? 'personal invitations'
                      : status === 'pending'
                        ? 'awaiting a little reply'
                        : 'sending love from afar'}
                </small>
              </div>
            ),
          )}
        </div>
        <section className="admin-panel">
          <h2>Invite someone special</h2>
          <form className="create-guest" onSubmit={createGuest}>
            <label htmlFor="guest-name">
              Guest’s full name
              <input
                id="guest-name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="One named guest per invitation"
              />
            </label>
            <button className="button" disabled={busy || !loaded}>
              Create invitation <span aria-hidden="true">+</span>
            </button>
          </form>
          <p className="note">
            Personal links give access to that guest’s RSVP. Share each link
            only with its intended guest.
          </p>
        </section>
        <section className="admin-panel">
          <div className="guest-toolbar">
            <h2>Your invitations</h2>
            <div>
              <button
                className="text-button"
                onClick={() => void refresh()}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Refresh'}
              </button>
              <button
                className="button secondary"
                onClick={() => void exportCsv()}
                disabled={busy || !loaded}
              >
                Export all CSV ↓
              </button>
            </div>
          </div>
          <div className="filters">
            <label htmlFor="search">
              Search guests
              <input
                id="search"
                type="search"
                placeholder="Find a name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label htmlFor="filter">
              Response
              <select
                id="filter"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as Attendance | 'all')
                }
              >
                <option value="all">All responses</option>
                <option value="attending">Attending</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
            </label>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Response</th>
                  <th scope="col">Birthday message</th>
                  <th scope="col">Personal invitation</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.name}</strong>
                      <small>1 invited seat</small>
                    </td>
                    <td>
                      <span className={`badge ${g.status}`}>{g.status}</span>
                    </td>
                    <td className="guest-message">{g.message || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => void copy(g)}
                          disabled={busy}
                        >
                          Copy link ↗
                        </button>
                        <button
                          className="text-button subtle"
                          onClick={() => {
                            setError('');
                            setRotating(g);
                          }}
                          disabled={busy}
                        >
                          Replace link
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loaded && !shown.length && (
            <p className="empty">
              {guests.length
                ? 'No guests match your search.'
                : 'Your guest book is waiting for its first invitation.'}
            </p>
          )}
          {!loaded && (
            <p className="empty">
              {busy
                ? 'Loading your guest book…'
                : 'Guest information could not be loaded. Try Refresh.'}
            </p>
          )}
        </section>
        {rotating && (
          <ReplaceDialog
            guest={rotating}
            busy={busy}
            error={error}
            confirm={() => void rotate()}
            cancel={() => setRotating(null)}
          />
        )}
      </main>
    </div>
  );
}

function ReplaceDialog({
  guest,
  busy,
  error,
  confirm,
  cancel,
}: {
  guest: Guest;
  busy: boolean;
  error: string;
  confirm: () => void;
  cancel: () => void;
}) {
  // Native modal supplies focus trapping and restores focus to the opener.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    dialog?.showModal();
    return () => dialog?.close();
  }, [dialog]);
  return (
    <dialog
      ref={setDialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cancel();
      }}
      aria-labelledby="replace-title"
    >
      <h2 id="replace-title">Replace this invitation?</h2>
      <p>
        The current link for <strong>{guest.name}</strong> will stop working
        immediately. Their saved RSVP will stay intact. Share the new link with
        them afterward.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button secondary"
          autoFocus
          disabled={busy}
          onClick={cancel}
        >
          Keep current link
        </button>
        <button className="button" disabled={busy} onClick={confirm}>
          {busy ? 'Replacing…' : 'Replace link'}
        </button>
      </div>
    </dialog>
  );
}
