# Prompt exportable — estado de Netz Control

Copiar desde el bloque siguiente para continuar el trabajo en otra conversación:

```text
Trabaja sobre el repositorio Netz Control y continúa desde su estado actual, sin reconstruir módulos ya implementados.

Antes de modificar código:
1. Lee APP_STATE.md y ADMIN_SETUP.md completos.
2. Revisa git status y preserva cambios existentes del usuario.
3. Inspecciona las migraciones Supabase hasta 20260622 y no asumas que están aplicadas en producción sin confirmación.
4. Mantén todos los efectos externos detrás de Netlify Functions o RPCs auditadas.

Arquitectura actual:
- React/Vite frontend.
- Supabase con RLS, perfiles, clientes, F29/F22, contactos, email_logs, billing_items, payment_events y activity_log.
- Netlify Functions para correo, recordatorios, adjuntos, Drive y billing.
- Resend para correo y Google OAuth/Drive.

Estado funcional:
- F29 mensual, F22, clientes, documentos, actividad y navegación están implementados.
- Email F29 permite preview, CC obligatorio, adjuntos, screenshot y programación a las 08:00.
- Safelist y roles se administran en /settings.
- Billing manual se administra en /billing con cobros, pagos, enlaces y recordatorios.
- No existe emisión SII, SimpleAPI, proveedor de pagos ni recordatorios automáticos.

Restricciones:
- Nunca almacenar contraseñas SII, claves de certificados ni credenciales crudas.
- No implementar emisión tributaria salvo solicitud explícita.
- Toda mutación debe dejar activity_log; pagos también payment_events y correos email_logs.
- Mantener interfaz SaaS interna, densa, profesional y sin estilo de marketing.

Al terminar cualquier cambio:
- Ejecuta npx tsc --noEmit, npm run test:importer y npm run build.
- Verifica visualmente las rutas afectadas.
- Actualiza APP_STATE.md si cambió el alcance o el estado real.
- Indica claramente qué migración o variable de entorno debe aplicar el usuario.

Solicitud nueva:
[ESCRIBIR AQUÍ LA SIGUIENTE TAREA]
```
