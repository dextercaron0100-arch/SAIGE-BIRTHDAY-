import { test, expect } from '@playwright/test';

test('preview cover, invitation, and sample RSVP work without a database', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let apiCalls = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) apiCalls++;
  });
  await page.goto('/preview');
  await expect(page.getByText('Avery', { exact: true })).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-envelope.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Open the envelope addressed to Avery' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Valyria Saige' }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-cover.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Open Invitation' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByText('Friday, September 11, 2026')).toBeVisible();
  await expect(page.getByText('12:00 PM – 2:00 PM')).toBeVisible();
  await expect(page.getByText('JOLLIBEE CROSSING')).toBeVisible();
  await expect(page.getByRole('link', { name: /Get directions/ })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-invitation.png`,
    fullPage: true,
    animations: 'disabled',
  });
  const viewport = page.viewportSize()!;
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport.width);
  await page.getByRole('radio', { name: /Joyfully attending/ }).check();
  await page.getByLabel(/A little wish/).fill('Happy first birthday, Valyria!');
  await page.getByRole('button', { name: /Try sample response/ }).click();
  await expect(page.getByRole('status')).toContainText(
    'Nothing was saved to a database.',
  );
  expect(apiCalls).toBe(0);
  expect(errors).toEqual([]);
});

test('real invitation token is removed from the URL and saved responses can be updated', async ({
  page,
}) => {
  const token = 'a'.repeat(64);
  await page.route('**/api/invitation', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ token });
    await route.fulfill({
      json: {
        name: 'Test Guest',
        status: 'attending',
        childrenCount: 2,
        message: 'Previously saved wish',
        closed: false,
        deadline: null,
      },
    });
  });
  let attempts = 0;
  await page.route('**/api/rsvp', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token,
      status: 'declined',
      childrenCount: 0,
      message: 'Updated wish',
    });
    attempts++;
    await route.fulfill(
      attempts === 1
        ? {
            status: 503,
            json: { error: 'Temporary service issue. Please retry.' },
          }
        : {
            json: {
              name: 'Test Guest',
              status: 'declined',
              childrenCount: 0,
              message: 'Updated wish',
              deadline: null,
              closed: false,
            },
          },
    );
  });
  await page.goto(`/#invite=${token}`);
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await page
    .getByRole('button', {
      name: 'Open the envelope addressed to Test Guest',
    })
    .click();
  await page.getByRole('button', { name: 'Open Invitation' }).click();
  await expect(
    page.getByRole('radio', { name: /Joyfully attending/ }),
  ).toBeChecked();
  await expect(page.getByLabel(/A little wish/)).toHaveValue(
    'Previously saved wish',
  );
  await expect(page.getByLabel('How many kids will be joining?')).toHaveValue(
    '2',
  );
  await page.getByRole('radio', { name: /Unable to attend/ }).check();
  await page.getByLabel(/A little wish/).fill('Updated wish');
  await page.getByRole('button', { name: /Update my response/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Temporary service issue',
  );
  await expect(page.getByLabel(/A little wish/)).toHaveValue('Updated wish');
  await page.getByRole('button', { name: /Update my response/ }).click();
  await expect(page.getByRole('status')).toContainText(
    'Your response has been saved',
  );
});

test('invalid links and unconnected organizer login give clear states', async ({
  page,
}) => {
  await page.route('**/api/invitation', (route) =>
    route.fulfill({
      status: 404,
      json: { error: 'This invitation link is invalid or has been replaced.' },
    }),
  );
  await page.goto('/#invite=invalid');
  await expect(
    page.getByText('This invitation link is invalid or has been replaced.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Invitation' }),
  ).toHaveCount(0);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Organizer sign in' }),
  ).toBeVisible();
});
