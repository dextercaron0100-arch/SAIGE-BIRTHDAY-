import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  dateLabel,
  dateParts,
  deadlineLabel,
  event,
  eventTimeLabel,
  type EventConfig,
} from '../shared/event';
import type { Invitation as InvitationData, Reply } from '../shared/types';
import { Bow, Icon } from './Bow';
import { RequestError } from './api';

export function RsvpForm({
  invitation,
  preview,
  save,
}: {
  invitation: InvitationData;
  preview: boolean;
  save: (reply: Reply) => Promise<InvitationData>;
}) {
  const [status, setStatus] = useState(invitation.status);
  const [childrenCount, setChildrenCount] = useState(invitation.childrenCount);
  const [message, setMessage] = useState(invitation.message);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(invitation.closed);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasSaved, setHasSaved] = useState(invitation.status !== 'pending');
  const [deadlineNow, setDeadlineNow] = useState(Date.now());
  useEffect(() => {
    if (!invitation.deadline || closed) return;
    const deadline = Date.parse(invitation.deadline);
    const update = () => {
      const current = Date.now();
      setDeadlineNow(current);
      if (current >= deadline) setClosed(true);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [closed, invitation.deadline]);
  const deadlineLeft = invitation.deadline
    ? Math.max(0, Date.parse(invitation.deadline) - deadlineNow)
    : null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (status === 'pending') {
      setError('Please choose an attendance response.');
      return;
    }
    setBusy(true);
    try {
      const result = await save({ status, childrenCount, message });
      setClosed(result.closed);
      setChildrenCount(result.childrenCount);
      setHasSaved(true);
      setSuccess(
        preview
          ? 'Sample response shown. Nothing was saved to a database.'
          : 'Your response has been saved. Thank you for being part of our story!',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
      if (err instanceof RequestError && err.status === 409) setClosed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rsvp-form">
      <div className="guest-label">
        <span>Your invitation</span>
        <strong>{invitation.name}</strong>
        <small>This invitation is reserved for you and your family.</small>
      </div>
      {hasSaved && !success && (
        <p className="note">
          {preview
            ? 'Your sample response is shown below.'
            : 'Your saved response is shown below. You can update it while RSVPs are open.'}
        </p>
      )}
      {deadlineLeft !== null && !closed && (
        <div className="rsvp-countdown-wrap">
          <span className="eyebrow">RSVP closes in</span>
          <CountdownDigits
            milliseconds={deadlineLeft}
            ariaLabel="Time remaining to send your RSVP"
            className="countdown rsvp-countdown"
          />
        </div>
      )}
      {closed && (
        <p className="notice" role="status">
          The RSVP deadline has passed. Please contact the family for any
          changes.
        </p>
      )}
      <fieldset disabled={busy || closed}>
        <legend>Will you be celebrating with us?</legend>
        <div className="response-options">
          <label className={status === 'attending' ? 'selected' : ''}>
            <input
              type="radio"
              name="attendance"
              value="attending"
              checked={status === 'attending'}
              onChange={() => {
                setStatus('attending');
                setSuccess('');
              }}
            />
            <span>
              <strong>Joyfully attending</strong>
              <small>Can’t wait to celebrate!</small>
            </span>
            <span className="choice-heart" aria-hidden="true">
              ♡
            </span>
          </label>
          <label className={status === 'declined' ? 'selected' : ''}>
            <input
              type="radio"
              name="attendance"
              value="declined"
              checked={status === 'declined'}
              onChange={() => {
                setStatus('declined');
                setChildrenCount(0);
                setSuccess('');
              }}
            />
            <span>
              <strong>Unable to attend</strong>
              <small>Sending love from afar</small>
            </span>
          </label>
        </div>
        {status === 'attending' && (
          <label className="children-count-label" htmlFor="children-count">
            How many kids will be joining?
            <select
              id="children-count"
              value={childrenCount}
              onChange={(e) => {
                setChildrenCount(Number(e.target.value));
                setSuccess('');
              }}
            >
              {Array.from({ length: 21 }, (_, count) => (
                <option key={count} value={count}>
                  {count === 0
                    ? 'No kids'
                    : `${count} ${count === 1 ? 'kid' : 'kids'}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="message-label" htmlFor="birthday-message">
          A little wish for Valyria <span>(optional)</span>
        </label>
        <textarea
          id="birthday-message"
          rows={4}
          maxLength={500}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSuccess('');
          }}
          placeholder="A birthday wish, a little love, a happy thought…"
          aria-describedby="message-count"
        />
        <small id="message-count" className="character-count">
          {message.length} / 500
        </small>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <button className="button full" type="submit" disabled={busy || closed}>
        {busy
          ? 'Saving your response…'
          : closed
            ? 'RSVPs are closed'
            : preview
              ? 'Try sample response'
              : hasSaved
                ? 'Update my response'
                : 'Send my RSVP'}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="form-footnote">
        {preview
          ? 'Preview only · No response is saved or sent.'
          : 'One family invitation, made with so much love.'}
      </p>
    </form>
  );
}

function CountdownDigits({
  milliseconds,
  ariaLabel,
  className = 'countdown',
}: {
  milliseconds: number;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={className} aria-label={ariaLabel}>
      {[
        [Math.floor(milliseconds / 86400000), 'days'],
        [Math.floor(milliseconds / 3600000) % 24, 'hours'],
        [Math.floor(milliseconds / 60000) % 60, 'minutes'],
        [Math.floor(milliseconds / 1000) % 60, 'seconds'],
      ].map(([n, label]) => (
        <span key={label}>
          <strong>{String(n).padStart(2, '0')}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}

function Countdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Date.parse(startsAt) - now);
  if (!left)
    return <p className="eyebrow">The birthday celebration is here!</p>;
  return (
    <CountdownDigits
      milliseconds={left}
      ariaLabel="Time until the celebration"
    />
  );
}

export function EventDetails({ config = event }: { config?: EventConfig }) {
  return (
    <section id="details" className="details section-pad">
      <div className="section-heading">
        <span className="eyebrow">A date to remember</span>
        <h2>
          A little party.
          <br />
          <em>A whole lot of love.</em>
        </h2>
        <p>Join us for a sweet celebration of one wonderful year.</p>
      </div>
      <div className="detail-grid">
        <article>
          <Icon kind="calendar" />
          <h3>The day</h3>
          <p>{dateLabel(config)}</p>
          <small>A very special first birthday</small>
        </article>
        <article>
          <Icon kind="clock" />
          <h3>The time</h3>
          <p>{eventTimeLabel(config)}</p>
          <small>
            {config.startsAt
              ? config.timezone
              : 'We’ll share the little details soon'}
          </small>
        </article>
        <article>
          <Icon kind="pin" />
          <h3>The place</h3>
          <p>{config.venue ?? 'To be announced'}</p>
          <small>{config.address ?? 'Somewhere filled with joy'}</small>
          {config.venue && config.mapUrl && (
            <a
              className="text-link"
              href={config.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions ↗
            </a>
          )}
        </article>
      </div>
      {config.startsAt && <Countdown startsAt={config.startsAt} />}
    </section>
  );
}

export function PhotoCarousel({ photos }: { photos: EventConfig['photos'] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const touchStart = useRef<number | null>(null);
  const move = (amount: number) =>
    setIndex((current) => (current + amount + photos.length) % photos.length);
  useEffect(() => {
    if (!playing || photos.length <= 1) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % photos.length),
      1500,
    );
    return () => window.clearTimeout(timer);
  }, [index, photos.length, playing]);
  const photo = photos[index];
  if (!photo) return null;
  return (
    <div
      className="photo-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Valyria’s first year photos"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        }
      }}
      onTouchStart={(e) => {
        touchStart.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX;
        if (touchStart.current === null || end === undefined) return;
        const distance = end - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) >= 45) move(distance > 0 ? -1 : 1);
      }}
    >
      <div className="carousel-stage">
        <img key={photo.src} src={photo.src} alt={photo.alt} />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-arrow previous"
              onClick={() => move(-1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="carousel-arrow next"
              onClick={() => move(1)}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>
      <p className="carousel-caption">{photo.alt}</p>
      <p
        className="carousel-status"
        aria-live={playing ? 'off' : 'polite'}
        aria-atomic="true"
      >
        Photo {index + 1} of {photos.length}
      </p>
      {photos.length > 1 && (
        <div className="carousel-controls">
          <div className="carousel-dots" aria-label="Choose a photo">
            {photos.map((item, itemIndex) => (
              <button
                type="button"
                key={item.src}
                className={itemIndex === index ? 'active' : ''}
                onClick={() => setIndex(itemIndex)}
                aria-label={`Show photo ${itemIndex + 1}`}
                aria-current={itemIndex === index ? 'true' : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            className="carousel-play-toggle"
            onClick={() => setPlaying((current) => !current)}
            aria-label={
              playing ? 'Pause automatic slideshow' : 'Play automatic slideshow'
            }
          >
            <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
}

export function InvitationPage({
  invitation,
  preview,
  save,
}: {
  invitation: InvitationData;
  preview: boolean;
  save: (reply: Reply) => Promise<InvitationData>;
}) {
  const [stage, setStage] = useState<'envelope' | 'cover' | 'invitation'>(
    'envelope',
  );
  const [openingEnvelope, setOpeningEnvelope] = useState(false);
  const [ribbonPlayCount, setRibbonPlayCount] = useState(0);
  const date = dateParts();
  const featuredPhoto = event.photos[0];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === 'invitation') {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [stage]);
  useEffect(() => {
    if (!openingEnvelope) return;
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const timer = window.setTimeout(
      () => {
        setStage('cover');
        setOpeningEnvelope(false);
      },
      reducedMotion ? 0 : 1500,
    );
    return () => window.clearTimeout(timer);
  }, [openingEnvelope]);
  if (stage === 'envelope')
    return (
      <main className={`envelope-stage ${openingEnvelope ? 'is-opening' : ''}`}>
        <div className="envelope-intro">
          <span className="eyebrow">A little something, just for you</span>
          <h1>You’ve got a special delivery</h1>
          <p>Tap the seal to open your invitation.</p>
        </div>
        <button
          type="button"
          className={`envelope ${openingEnvelope ? 'is-opening' : ''}`}
          onClick={() => setOpeningEnvelope(true)}
          disabled={openingEnvelope}
          aria-label={`Open the envelope addressed to ${invitation.name}`}
        >
          <span className="envelope-letter" aria-hidden="true">
            <span>Valyria Saige</span>
            <small>turns one</small>
          </span>
          <span className="envelope-back" aria-hidden="true" />
          <span className="envelope-flap" aria-hidden="true" />
          <span className="envelope-pocket" aria-hidden="true" />
          <span className="envelope-address">
            <small>Specially delivered to</small>
            <strong>{invitation.name}</strong>
          </span>
          <span className="wax-seal" aria-hidden="true">
            <span>V</span>
          </span>
        </button>
        <button
          type="button"
          className="envelope-open-label"
          onClick={() => setOpeningEnvelope(true)}
          disabled={openingEnvelope}
        >
          {openingEnvelope ? 'Opening your invitation…' : 'Open the envelope'}
          <span aria-hidden="true">♡</span>
        </button>
        <p className="envelope-footnote">
          Sealed with love by Valyria’s family
        </p>
      </main>
    );
  if (stage === 'cover')
    return (
      <main className="cover">
        <div className="cover-card">
          <span className="ornament corner-tl" aria-hidden="true">
            ❦
          </span>
          <span className="ornament corner-tr" aria-hidden="true">
            ❦
          </span>
          <span className="ornament corner-bl" aria-hidden="true">
            ❦
          </span>
          <span className="ornament corner-br" aria-hidden="true">
            ❦
          </span>
          <button
            type="button"
            className="cover-bow-button"
            onClick={() => setRibbonPlayCount((count) => count + 1)}
            aria-label="Play with Valyria’s satin bow"
            title="Tap the bow for a little birthday magic"
          >
            <span
              key={ribbonPlayCount}
              className={`cover-bow-motion ${ribbonPlayCount ? 'is-playing' : ''}`}
              aria-hidden="true"
            >
              <img
                className="cover-satin-bow"
                src="/assets/satin-bow.webp"
                alt=""
                fetchPriority="high"
              />
              <span className="bow-sparkle bow-sparkle-one">✦</span>
              <span className="bow-sparkle bow-sparkle-two">✧</span>
              <span className="bow-sparkle bow-sparkle-three">✦</span>
              <span className="bow-sparkle bow-sparkle-four">♡</span>
            </span>
          </button>
          <div className="cover-content">
            <p className="cover-kicker">You’re invited to a</p>
            <div className="cover-title">
              <span>Beautiful</span>
              <strong>First Birthday</strong>
              <span>Celebration</span>
            </div>
            <div className="gold-rule" aria-hidden="true">
              <span>❧</span>
            </div>
            <p className="cover-honor">In honor of</p>
            <h1>{event.name}</h1>
            <p className="cover-turns">turning one</p>
            <div className="gold-rule compact" aria-hidden="true">
              <span>♡</span>
            </div>
            <div className="cover-details" aria-label="Celebration details">
              <span>
                <Icon kind="calendar" />
                <b>
                  {date.day} {date.month.toUpperCase()} {date.year}
                </b>
                <small>{date.weekday.toUpperCase()}</small>
              </span>
              <span>
                <Icon kind="clock" />
                <b>
                  {event.startsAt
                    ? eventTimeLabel(event).toUpperCase()
                    : 'TO BE ANNOUNCED'}
                </b>
                <small>PARTY TIME</small>
              </span>
              <span>
                <Icon kind="pin" />
                <b>{event.venue?.toUpperCase() ?? 'TO BE ANNOUNCED'}</b>
                <small>CELEBRATION VENUE</small>
              </span>
            </div>
            <div className="cover-guest">
              <span>Especially for</span>
              <h2>{invitation.name}</h2>
              <small>One invitation for your family, with all our love</small>
            </div>
            <button className="button" onClick={() => setStage('invitation')}>
              Open Invitation <span aria-hidden="true">↗</span>
            </button>
            <p className="cover-rsvp">R · S · V · P</p>
          </div>
        </div>
        <p className="cover-bottom">
          A whole year of wonder · a lifetime of love
        </p>
      </main>
    );
  return (
    <>
      <header className="site-header">
        <a
          href="#top"
          className="wordmark"
          aria-label="Valyria Saige, back to top"
        >
          Valyria <span>Saige</span>
          <i>♡</i>
        </a>
        <nav aria-label="Invitation navigation">
          <a href="#details">The celebration</a>
          <a className="nav-rsvp" href="#rsvp">
            Kindly RSVP <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="small-line" />
              Oh, what a ONE-derful year
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {event.name.split(' ')[0]}
              <br />
              <em>{event.name.split(' ').slice(1).join(' ')}</em>
              <span className="turns-one">Turns One</span>
            </h1>
            <p>
              Twelve months of tiny giggles, little discoveries,
              <br className="desktop-break" /> and more love than we ever
              imagined.
            </p>
            <p>Come make a beautiful memory with us.</p>
            <a className="button" href="#rsvp">
              Celebrate with us <span aria-hidden="true">↗</span>
            </a>
            <div className="hero-date">
              <span className="date-day">{date.day}</span>
              <span>
                {date.month.toUpperCase()} {date.year}
                <small>{date.weekday} · A day for joy</small>
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label={
              featuredPhoto
                ? undefined
                : 'Decorative number one with a pink bow'
            }
          >
            <span className="art-spark art-spark-a" aria-hidden="true">
              ✧
            </span>
            <span className="art-spark art-spark-b" aria-hidden="true">
              ✦
            </span>
            <div className={`arch ${featuredPhoto ? 'has-photo' : ''}`}>
              <div className="arch-inner">
                {featuredPhoto && (
                  <img
                    className="hero-photo"
                    src={featuredPhoto.src}
                    alt={featuredPhoto.alt}
                    fetchPriority="high"
                  />
                )}
              </div>
              {!featuredPhoto && (
                <img
                  className="satin-bow-small"
                  src="/assets/satin-bow.webp"
                  alt=""
                />
              )}
              <span className="big-one">1</span>
              <span className="art-caption">
                our birthday girl <em>pretty in pink</em>
              </span>
              <span className="art-flower" aria-hidden="true">
                ✳
              </span>
            </div>
            <span className="art-note">our sweetest little blessing</span>
          </div>
        </section>
        <div className="love-strip">
          <span aria-hidden="true">✧</span> Little hands. Big dreams. Endless
          love. <span aria-hidden="true">✧</span>
        </div>
        <EventDetails />
        {event.photos.length > 0 && (
          <section
            className="gallery section-pad"
            aria-labelledby="gallery-title"
          >
            <div className="section-heading">
              <span className="eyebrow">Our little sunshine</span>
              <h2 id="gallery-title">
                A year of <em>sweet moments.</em>
              </h2>
            </div>
            <PhotoCarousel photos={event.photos} />
          </section>
        )}
        <section id="rsvp" className="rsvp-section section-pad">
          <div className="rsvp-intro">
            <Icon kind="heart" />
            <span className="eyebrow">Your presence is our present</span>
            <h2>
              Save a little <br />
              room for <em>joy.</em>
            </h2>
            <p>Dear {invitation.name},</p>
            <p>
              Our celebration would be even sweeter with you. Let us know if you
              can join us for Valyria’s very first birthday.
            </p>
            <p>
              Should you wish to honor me with a gift, a little help toward my
              daily needs and future would be much appreciated.
            </p>
            <div className="deadline">
              <span className="eyebrow">Kindly reply by</span>
              <p>
                {invitation.deadline
                  ? `${deadlineLabel(invitation.deadline)} (${event.timezone})`
                  : 'To be announced'}
              </p>
              {!invitation.deadline && (
                <small>You’re welcome to send your response now.</small>
              )}
            </div>
            <Bow />
          </div>
          <RsvpForm invitation={invitation} preview={preview} save={save} />
        </section>
        <section className="closing">
          <span aria-hidden="true">♡</span>
          <span className="eyebrow">From our family to you</span>
          <h2>
            The sweetest memories
            <br />
            are made <em>together.</em>
          </h2>
          <p>
            Thank you for filling Valyria’s world with so much love.
            <br />
            We can’t wait to celebrate this little milestone with you.
          </p>
          <p className="signature">With love, Valyria’s family</p>
        </section>
      </main>
      <footer>
        <span>VALYRIA SAIGE · TURNS ONE</span>
        <span>
          {event.date.split('-').reverse().join('.')} <i>♡</i> Made with love
        </span>
      </footer>
    </>
  );
}
