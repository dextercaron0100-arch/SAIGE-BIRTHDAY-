import { createClient } from '@supabase/supabase-js';
import type { Guest } from '../shared/types.js';
import { ApiError, type Repository } from './service.js';

export function createRepository(): Repository {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT') || key.startsWith('YOUR_'))
    throw new ApiError(
      503,
      'Invitations are not connected yet. Please contact the family, or visit /preview for a sample.',
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = (error: unknown) => {
    if (error)
      throw new ApiError(
        503,
        'We could not reach the invitation service. Please try again.',
      );
  };
  return {
    async find(token) {
      const { data, error } = await db
        .from('guests')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      check(error);
      return data as Guest | null;
    },
    async reply(token, reply, deadline) {
      const { data, error } = await db.rpc('save_rsvp', {
        p_token: token,
        p_status: reply.status,
        p_message: reply.message,
        p_deadline: deadline,
      });
      if (error?.message === 'RSVP_CLOSED')
        throw new ApiError(
          409,
          'The RSVP deadline has passed. Please contact the family.',
        );
      check(error);
      return (data?.[0] ?? null) as Guest | null;
    },
    async list() {
      // Supabase caps each response; fetch every page so totals and exports stay complete.
      const guests: Guest[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await db
          .from('guests')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id')
          .range(start, start + 999);
        check(error);
        guests.push(...((data ?? []) as Guest[]));
        if (!data || data.length < 1000) return guests;
      }
    },
    async create(name, token) {
      const { data, error } = await db
        .from('guests')
        .insert({ name, token })
        .select()
        .single();
      check(error);
      return data as Guest;
    },
    async update(id, changes) {
      const { data, error } = await db
        .from('guests')
        .update(changes)
        .eq('id', id)
        .select()
        .maybeSingle();
      check(error);
      return data as Guest | null;
    },
    async rotate(id, token) {
      const { data, error } = await db
        .from('guests')
        .update({ token })
        .eq('id', id)
        .select()
        .maybeSingle();
      check(error);
      return data as Guest | null;
    },
    async userId(jwt) {
      const { data, error } = await db.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },
  };
}
