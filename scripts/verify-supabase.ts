import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !secretKey || !publicKey) {
  throw new Error('Supabase environment variables are incomplete.');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);
const publicClient = createClient(url, publicKey, options);

const [database, anonymousTable, anonymousRpc, users] = await Promise.all([
  admin.from('guests').select('id', { count: 'exact', head: true }),
  publicClient.from('guests').select('id').limit(1),
  publicClient.rpc('save_rsvp', {
    p_token: '0'.repeat(64),
    p_status: 'attending',
    p_message: '',
    p_deadline: null,
  }),
  admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
]);

const allowlistedIds = (process.env.ORGANIZER_USER_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const authUsers = users.data?.users ?? [];

const report = {
  database: {
    connected: database.status === 200,
    status: database.status,
    guestCount: database.count,
  },
  anonymousTableBlocked: [401, 403].includes(anonymousTable.status),
  anonymousRpcBlocked: [401, 403].includes(anonymousRpc.status),
  authUserCount: authUsers.length,
  organizerAllowlistConfigured: allowlistedIds.length > 0,
  allowlistedUsersExist:
    allowlistedIds.length > 0 &&
    allowlistedIds.every((id) => authUsers.some((user) => user.id === id)),
  allowlistedUsersConfirmed:
    allowlistedIds.length > 0 &&
    allowlistedIds.every((id) =>
      authUsers.some((user) => user.id === id && user.email_confirmed_at),
    ),
};

console.log(JSON.stringify(report, null, 2));

if (
  !report.database.connected ||
  !report.anonymousTableBlocked ||
  !report.anonymousRpcBlocked ||
  !report.allowlistedUsersExist ||
  !report.allowlistedUsersConfirmed
) {
  process.exitCode = 1;
}
