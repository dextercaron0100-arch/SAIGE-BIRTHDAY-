import type { Guest } from '../shared/types.js';

function cell(value: string) {
  // Check past leading whitespace/control characters, including tabs and CR.
  const safe =
    /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function guestsCsv(guests: Guest[]) {
  return (
    '\uFEFF' +
    [
      [
        'Name',
        'Response',
        'Children joining',
        'Birthday message',
        'Updated at',
      ],
      ...guests.map((g) => [
        g.name,
        g.status,
        g.status === 'attending' ? String(g.children_count) : '0',
        g.message,
        g.updated_at,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}
