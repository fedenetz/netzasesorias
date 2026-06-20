# Estado actual de Netz Control

Fecha de corte: 19 de junio de 2026.

## Estado general

La aplicación evolucionó desde un control interno F29/F22 hacia una base de gestión de clientes, comunicaciones y cobros. El frontend es React/Vite; Supabase mantiene datos, RLS y RPCs auditadas; Netlify Functions contiene efectos externos; Resend entrega correo; Google OAuth identifica empleados y habilita lectura de Drive.

## Implementado

### Acceso y administración

- Login con Google, perfiles activos y roles `admin`, `accountant`, `viewer`.
- Safelist administrable en `/settings`.
- Vinculación por nombre operativo y email del responsable.
- Confirmación antes de cerrar sesión.
- RLS employee-only y auditoría de cambios administrativos.

### Clientes y documentos

- Cartera, perfil, contactos múltiples, observaciones y actividad.
- Código Conta, responsable coloreado, estado F29 y billing.
- Indexación y búsqueda transversal de documentos Drive.
- Recarga rápida cuando un cliente no muestra documentos.

### F29

- Dashboard mensual denso con filtros rápidos.
- Estado dinámico: Cargada, Informada, Pagada/Enviada y pago vencido.
- Monto actual/anterior en CLP, control de pago tributario y recordatorios.
- RN Observaciones visible para todos y editable solamente por administradores.
- Fecha del primer email y fecha límite electrónica con fines de semana/feriados.

### Email F29

- Compositor editar → preview → confirmar.
- Plantillas, destinatarios recordados, múltiples direcciones Para/CC y CC obligatorio responsable + control.
- Adjuntos privados, Drive, Google Sheets exportadas y screenshots pegadas.
- Envío inmediato o próximo día hábil a las 08:00 Chile.
- Logs de intentos exitosos/fallidos e idempotencia de Resend.

### Billing

- Ledger `billing_items` y dashboard `/billing`.
- KPIs pendientes, vencidos, pagados del mes, clientes impagos y último recordatorio.
- Creación y edición manual de cobros.
- Estado pagado/no pagado, eventos, método, notas y vencimiento.
- Enlaces externos HTTPS manuales y recordatorios confirmados.

### Navegación

- Resumen, Clientes, F29, F22, Facturación, Documentos, Actividad y Configuración tienen rutas funcionales.
- Búsqueda global de clientes y acceso a auditoría desde la campana.

## Fuera de alcance o pendiente

- Emisión real de facturas/boletas mediante SII o SimpleAPI.
- Integración con proveedor de pagos.
- Recordatorios automáticos sin confirmación humana.
- Backfill histórico automático de honorarios.
- Calendario de feriados posteriores a 2027.
- Confirmar en producción que todas las migraciones hasta `20260622` estén aplicadas.
- Validar al menos un envío programado completo en el deploy real.
- División del bundle frontend; actualmente existe una advertencia no bloqueante sobre un chunk superior a 500 kB.

## Seguridad vigente

- Sin contraseñas SII ni claves de certificados.
- Secretos únicamente en Netlify/server-side.
- Adjuntos en bucket privado.
- Efectos auditados en `activity_log`.
- `invoices` es metadata placeholder, sin emisión.

## Verificación más reciente

- TypeScript sin errores.
- Build Vite de producción exitoso.
- 12 pruebas automatizadas exitosas.
- Verificación visual de Configuración, Billing, Documentos, Actividad y búsqueda global.
