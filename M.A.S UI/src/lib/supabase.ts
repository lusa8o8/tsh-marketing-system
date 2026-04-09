import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

async function validateSession(session: Session | null) {
  if (!session?.access_token) return null;

  const { error } = await supabase.auth.getUser(session.access_token);
  if (error) {
    await supabase.auth.signOut();
    return null;
  }

  return session;
}

export async function getActiveSession() {
  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const expiresAt = session?.expires_at ?? 0;
  const isExpired = expiresAt > 0 && expiresAt * 1000 <= Date.now();

  if (!session?.access_token || isExpired) {
    const refreshResult = await supabase.auth.refreshSession();

    if (refreshResult.error) {
      await supabase.auth.signOut();
      return null;
    }

    return validateSession(refreshResult.data.session ?? null);
  }

  return validateSession(session);
}

export async function getAccessToken() {
  const session = await getActiveSession();
  return session?.access_token ?? null;
}
