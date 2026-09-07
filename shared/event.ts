export interface EventConfig {
  name: string;
  date: string;
  timezone: string;
  startsAt: string | null;
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
  startsAt: null, // Example: '2026-09-11T14:00:00+08:00'
  venue: null,
  address: null,
  mapUrl: null,
  rsvpDeadline: null, // Example: '2026-09-09T23:59:00+08:00'
  photos: [
    {
      src: '/photos/valyria-pink-portrait.png',
      alt: 'Valyria sitting in a pink birthday portrait setting',
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
  for (const value of [config.startsAt, config.rsvpDeadline]) {
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

export function deadlineLabel(timestamp: string, config = event) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
