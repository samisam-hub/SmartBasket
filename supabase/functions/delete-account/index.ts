const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const authorization = req.headers.get('authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
      return json({ error: 'Account deletion is not available.' }, 503);
    }
    // Resolve the user from the caller's token. The function never accepts a user id from the client.
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
    });
    if (!userResponse.ok) return json({ error: 'Please sign in again.' }, 401);
    const user = await userResponse.json() as { id?: string; is_anonymous?: boolean; email_confirmed_at?: string | null };
    if (!user.id || user.is_anonymous || !user.email_confirmed_at) return json({ error: 'Only a confirmed account can be deleted.' }, 403);
    const deletion = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    if (!deletion.ok) return json({ error: 'Account deletion failed. Please retry.' }, 502);
    return json({ ok: true });
  } catch {
    return json({ error: 'Account deletion failed. Please retry.' }, 502);
  }
});
