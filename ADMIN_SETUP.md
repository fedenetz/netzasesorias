# Configuración administrativa de Netz Control

Última actualización: 19 de junio de 2026.

## 1. Orden de base de datos

En un proyecto nuevo, ejecutar primero `supabase/schema.sql`. Después aplicar, en orden:

1. `20260618_add_f22_periods.sql`
2. `20260619_add_email_billing_foundation.sql`
3. `20260620_refine_f29_operations.sql`
4. `20260621_refine_f29_mail_delivery.sql`
5. `20260622_admin_billing_navigation.sql`

No volver a pegar migraciones parcialmente en SQL Editor. Ejecutar siempre el archivo completo.

## 2. Variables de Netlify

Obligatorias:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Netz Asesorías <impuestos@netzasesorias.cl>
RESEND_REPLY_TO_EMAIL=richard@ainahue.cl
FIRM_NAME=Netz Asesorías
```

La service-role y la API key de Resend son exclusivamente server-side. Nunca usar prefijo `VITE_` para ellas.

## 3. Google OAuth

- Google Cloud debe aceptar `https://PROJECT_REF.supabase.co/auth/v1/callback`.
- Supabase Authentication debe tener Google habilitado.
- La URL de producción y `http://127.0.0.1:4173/**` deben estar autorizadas como redirect URLs.
- El frontend solicita acceso de solo lectura a Google Drive.

## 4. Primer administrador

El primer usuario debe iniciar sesión una vez para crear su `profile`. Luego habilitarlo temporalmente desde Supabase:

```sql
update public.profiles
set is_active = true, role = 'admin', updated_at = now()
where email = 'CORREO_ADMIN';
```

A partir de ese momento, toda la administración se realiza desde **Configuración → Equipo y acceso**.

## 5. Equipo y safelist

Para cada responsable:

1. Abrir `/settings` como administrador.
2. Seleccionar **Autorizar correo**.
3. Escribir el nombre operativo exactamente como aparece en F29, por ejemplo `GABRIELA`.
4. Registrar su email Google y rol.
5. Mantener **Acceso activo** marcado.

El email queda disponible inmediatamente para los CC obligatorios, aunque la persona todavía no haya iniciado sesión. Cuando ingrese con Google, la cuenta se vincula automáticamente.

Roles:

- `admin`: configuración, safelist y operaciones completas.
- `accountant`: operación contable y comunicaciones.
- `viewer`: lectura operacional.

No desactivar ni quitar el rol admin a la propia cuenta; la RPC bloquea ese cierre accidental.

## 6. Resend y correo

- El dominio de envío debe aparecer como verificado en Resend.
- `richard@ainahue.cl` se agrega como CC de control para F29.
- El responsable activo también se agrega como CC.
- El cliente debe usar **Responder a todos** para que todos reciban su respuesta.
- Los adjuntos privados tienen límite combinado de 10 MB.
- Los envíos programados se reconcilian mediante `reconcile-scheduled-emails`.

## 7. Billing

Desde `/billing` se pueden crear cobros manuales, seleccionar cliente/servicio, establecer monto y vencimiento, marcar pagos, guardar enlaces HTTPS y preparar recordatorios.

Esto no emite documentos tributarios. `invoices` continúa siendo solamente un placeholder; no existe integración SII, SimpleAPI ni proveedor de pagos.

## 8. Checklist posterior al deploy

- Iniciar sesión y confirmar que aparece el panel interno.
- Abrir Configuración y verificar los responsables activos.
- Preparar un F29 y comprobar destinatario, CC y adjuntos sin enviarlo.
- Crear un cobro de prueba y revisar que aparezca en `/billing`.
- Confirmar registros en `activity_log`, `email_logs` y `payment_events`.
- Verificar `/documents`, `/activity`, `/clients`, `/billing` y `/settings`.

Nunca almacenar contraseñas SII, claves de certificados digitales ni credenciales crudas.
