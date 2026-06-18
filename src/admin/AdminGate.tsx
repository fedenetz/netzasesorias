import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { AdminApp } from './AdminApp';
import { isSupabaseConfigured, signInWithGoogle, supabase } from './supabase';

export function AdminGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const preview = import.meta.env.DEV && !isSupabaseConfigured;

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
      const { data } = await client.from('profiles').select('is_active').eq('id', nextSession.user.id).maybeSingle();
      setAuthorized(Boolean(data?.is_active));
      setLoading(false);
    };
    client.auth.getSession().then(({ data }) => acceptSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void acceptSession(nextSession), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="control-loading">Cargando entorno seguro…</div>;
  if ((session && authorized) || preview) return <AdminApp user={session?.user ?? null} preview={preview} />;

  if (session && authorized === false) return (
    <main className="control-login">
      <section className="control-login-panel">
        <a href="/" className="control-login-brand"><img src="/brand/icono-blanco.png" alt="" /><strong>NETZ</strong></a>
        <div className="control-login-copy">
          <span className="control-secure-label"><LockKeyhole size={14} /> Aprobación requerida</span>
          <h1>Tu acceso aún no está habilitado</h1>
          <p>La cuenta fue autenticada correctamente, pero un administrador debe activarla como empleado de Netz.</p>
          <button className="control-google-button" type="button" onClick={() => supabase?.auth.signOut()}>
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
          <button className="control-google-button" type="button" onClick={() => signInWithGoogle()}>
            <span className="google-mark">G</span>
            Continuar con Google
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
