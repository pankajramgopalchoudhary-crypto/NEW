// Thin Supabase JS client — used ONLY for Realtime channel subscriptions
// (broadcast events from the backend for ticket updates).
//
// The rest of the app uses the REST wrapper in `supabaseRest.js` which is
// kept as-is; the two coexist and never share sessions.
import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = (url && anon)
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
