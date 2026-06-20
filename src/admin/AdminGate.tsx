import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { AdminApp } from './AdminApp';
import { isSupabaseConfigured, signInWithGoogle, supabase } from './supabase';

export function AdminGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState<'admin' | 'accountant' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authStarting, setAuthStarting] = useState(false);
  const preview = import.meta.env.DEV && (!isSupabaseConfigured || new URLSearchParams(window.location.search).has('preview'));
  const requestedPreviewRole = new URLSearchParams(window.location.search).get('role');
  const previewRole = requestedPreviewRole === 'viewer' || requestedPreviewRole === 'accountant' ? requestedPreviewRole : 'admin';
  const startGoogleLogin = async () => {
    setAuthStarting(true);
    try { await signInWithGoogle(); }
    catch { setAuthStarting(false); }
  };

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const acceptSession = async (nextSession: Session | null) => {
      setSession(nextSession);
      if (!nextSession) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const { data } = await client.from('profiles').select('is_active,role').eq('id', nextSession.user.id).maybeSingle();
      setAuthorized(Boolean(data?.is_active));
      setRole(data?.role ?? 'viewer');
      setLoading(false);
    };
    client.auth.getSession().then(({ data }) => acceptSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void acceptSession(nextSession), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="control-loading">Cargando entorno seguro…</div>;
  if ((session && authorized) || preview) return <AdminApp user={session?.user ?? null} preview={preview} role={preview ? previewRole : role} />;

  if (session && authorized === false) return (
    <main className="control-login">
      <section className="control-login-panel">
        <a href="/" className="control-login-brand"><img src="/brand/icono-blanco.png" alt="" /><strong>NETZ</strong></a>
        <div className="control-login-copy">
          <span className="control-secure-label"><LockKeyhole size={14} /> Aprobación requerida</span>
          <h1>Tu acceso aún no está habilitado</h1>
          <p>La cuenta fue autenticada correctamente, pero un administrador debe activarla como empleado de Netz.</p>
          <button className="control-google-button" type="button" onClick={() => window.confirm('¿Cerrar esta sesión de Netz?') && void supabase?.auth.signOut()}>
            Cerrar sesión
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <aside className="control-login-art" aria-hidden="true"><div className="login-art-card"><strong>403</strong><span>Acceso interno pendiente.</span></div></aside>
    </main>
  );

  return (
    <main className="control-login">
      <section className="control-login-panel">
        <a href="/" className="control-login-brand"><img src="/brand/icono-blanco.png" alt="" /><strong>NETZ</strong></a>
        <div className="control-login-copy">
          <span className="control-secure-label"><LockKeyhole size={14} /> Acceso interno</span>
          <h1>Control de cumplimiento tributario</h1>
          <p>Espacio de trabajo exclusivo para el equipo Netz. Ingresa con tu cuenta corporativa autorizada.</p>
          <button className={`control-google-button ${authStarting ? 'is-starting' : ''}`} type="button" disabled={authStarting} onClick={() => void startGoogleLogin()}>
            <GoogleLogo />
            {authStarting ? 'Conectando con Google…' : 'Continuar con Google'}
            <ArrowRight size={17} />
          </button>
          <small>El acceso se valida mediante Google, la lista de empleados y las políticas de seguridad de la base de datos.</small>
        </div>
      </section>
      <aside className="control-login-art" aria-hidden="true">
        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />
        <div className="login-art-card"><strong>F29</strong><span>Operación mensual bajo control.</span></div>
      </aside>
    </main>
  );
}

function GoogleLogo() {
  return <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>;
}
