import { supabase } from '../lib/supabaseClient.js';
import { asError } from '../lib/errors.js';

/** Registro: no escribe en public.Usuarios aquí; lo hace el trigger o el login */
export async function signUp({ email, password, nombre_completo, rol = 'productor' }) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre_completo, rol },
      emailRedirectTo: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined,
    }
  });
  if (error) throw asError(error);
  return data;
}

/** Login: si password login está deshabilitado, cae a Magic Link */
export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Supabase no configurado');

  const r = await supabase.auth.signInWithPassword({ email, password });
  if (r.error) {
    if (/email logins are disabled/i.test(r.error.message)) {
      const { data, error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      });
      if (otpErr) throw asError(otpErr);
      return { magicLinkSent: true };
    }
    throw asError(r.error);
  }

  await ensureProfile(r.data?.user);
  return r.data;
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.auth.signOut();
  if (error) throw asError(error);
}

export async function resetPassword(email) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined'
      ? `${window.location.origin}/reset`
      : undefined,
  });
  if (error) throw asError(error);
  return true;
}

export async function updatePassword(newPassword) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw asError(error);
  return data;
}

export async function resendConfirmation(email) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw asError(error);
  return data;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw asError(error);
  return data.session || null;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

/** Perfil */
export async function fetchUsuarioProfile({ auth_user_id, email }) {
  if (!supabase) throw new Error('Supabase no configurado');

  if (auth_user_id) {
    const { data, error } = await supabase
      .from('Usuarios')
      .select('id_usuario, nombre_completo, rol, email, auth_user_id')
      .eq('auth_user_id', auth_user_id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw asError(error);
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from('Usuarios')
      .select('id_usuario, nombre_completo, rol, email, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw asError(error);
    return data || null;
  }

  return null;
}

export async function maybeCreateOrUpdateProfile({ auth_user_id, email, nombre_completo, rol = 'productor' }) {
  if (!supabase) throw new Error('Supabase no configurado');
  if (!email && !auth_user_id) return null;

  if (auth_user_id) {
    const existing = await supabase
      .from('Usuarios')
      .select('id_usuario, nombre_completo, rol, email, auth_user_id')
      .eq('auth_user_id', auth_user_id)
      .maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') throw asError(existing.error);
    if (existing.data) {
      const patch = {};
      if (!existing.data.nombre_completo && nombre_completo) patch.nombre_completo = nombre_completo;
      if (!existing.data.rol && rol) patch.rol = rol;
      if (!existing.data.email && email) patch.email = email;
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase.from('Usuarios').update(patch).eq('auth_user_id', auth_user_id);
        if (upErr) throw asError(upErr);
      }
      return existing.data;
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('Usuarios')
    .upsert({ auth_user_id, email, nombre_completo, rol }, { onConflict: 'email' })
    .select()
    .maybeSingle();

  if (insErr && insErr.code !== 'PGRST116') throw asError(insErr);
  return inserted || null;
}

async function ensureProfile(user) {
  if (!user) return;
  const md = user.user_metadata || {};
  await maybeCreateOrUpdateProfile({
    auth_user_id: user.id,
    email: user.email,
    nombre_completo: md.nombre_completo || null,
    rol: md.rol || 'productor',
  });
}

/** ===== MFA (TOTP) Helpers ===== */
export async function mfaEnrollTOTP() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw asError(error);
  return data; // { id, type, totp: { qr_code, secret } }
}

export async function mfaVerifyEnrollment({ factorId, code }) {
  const { data, error } = await supabase.auth.mfa.verify({ factorId, code });
  if (error) throw asError(error);
  return data;
}

export async function mfaChallengeAndVerify({ factorId, code }) {
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw asError(chErr);
  const { data: verified, error: vErr } = await supabase.auth.mfa.verify({ factorId, code, challengeId: challenge.id });
  if (vErr) throw asError(vErr);
  return verified;
}
