export interface EventConfig {
  name: string;
  date: string;
  timezone: string;
  startsAt: string | null;
  endsAt: string | null;
  venue: string | null;
  address: string | null;
  mapUrl: string | null;
  rsvpDeadline: string | null;
  photos: { src: string; alt: string }[];
  colors: { background: string; paper: string; rose: string; text: string };
}

export const event: EventConfig = {
  name: 'Valyria Saige',
  date: '2026-09-11',
  timezone: 'Asia/Manila',
  startsAt: '2026-09-11T18:00:00+08:00',
  endsAt: '2026-09-11T20:00:00+08:00',
  venue: 'JOLLIBEE CROSSING',
  address: null,
  mapUrl: null,
  rsvpDeadline: null, // Example: '2026-09-09T23:59:00+08:00'
  photos: [
    {
      src: '/photos/valyria-pink-portrait.png',
      alt: 'Valyria sitting in a pink birthday portrait setting',
    },
    {
      src: '/photos/valyria-newborn-closeup.jpeg',
      alt: 'A close-up portrait of newborn Valyria',
    },
    {
      src: '/photos/valyria-one-month.jpg',
      alt: 'Valyria smiling beside a soft white number one',
    },
    {
      src: '/photos/valyria-poolside.jpeg',
      alt: 'Valyria being held beside a sunny swimming pool',
    },
    {
      src: '/photos/valyria-sunflower-outfit.jpeg',
      alt: 'Valyria wearing a handmade red and green sunflower outfit',
    },
    {
      src: '/photos/valyria-sunflower-closeup.jpeg',
      alt: 'A close-up of Valyria in her sunflower outfit',
    },
    {
      src: '/photos/valyria-mermaid-portrait.png',
      alt: 'Valyria posing in a colorful mermaid portrait setting',
    },
  ],
  colors: {
    background: '#fbe9ef',
    paper: '#fffaf7',
    rose: '#b63e69',
    text: '#5e3344',
  },
};

export function validateEvent(config: EventConfig) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(config.date) ||
    !Number.isFinite(Date.parse(`${config.date}T12:00:00Z`)) ||
    new Date(`${config.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      config.date
  )
    throw new Error('Event date must be a valid YYYY-MM-DD date.');
  new Intl.DateTimeFormat('en', { timeZone: config.timezone });
  for (const value of [config.startsAt, config.endsAt, config.rsvpDeadline]) {
    if (
      value !== null &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)))
    ) {
      throw new Error(
        'Event timestamps require a valid date and explicit timezone offset.',
      );
    }
  }
  if (
    config.startsAt &&
    config.endsAt &&
    Date.parse(config.endsAt) <= Date.parse(config.startsAt)
  )
    throw new Error('Event end time must be after its start time.');
  if (config.mapUrl && new URL(config.mapUrl).protocol !== 'https:')
    throw new Error('Map URL must use HTTPS.');
}

validateEvent(event);

export function dateLabel(config = event) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${config.date}T12:00:00Z`));
}

export function dateParts(config = event) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${config.date}T12:00:00Z`));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function timeLabel(timestamp: string, config = event) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function eventTimeLabel(config = event) {
  if (!config.startsAt) return 'To be announced';
  const start = timeLabel(config.startsAt, config);
  return config.endsAt
    ? `${start} – ${timeLabel(config.endsAt, config)}`
    : start;
}

export function deadlineLabel(timestamp: string, config = event) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
