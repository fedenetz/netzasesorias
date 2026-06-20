# Estado actual de Netz Control

Fecha de corte: 20 de junio de 2026.

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
- Barra de acciones fija en escritorio y móvil, con estados de carga que bloquean cierres o envíos duplicados.
- Revisión detallada de adjuntos con nombre, tipo, tamaño, origen, quitar/reemplazar y miniatura firmada para comprobantes privados.
- Los comprobantes de imagen seleccionados se muestran dentro del HTML mediante CID y conservan además el archivo adjunto original.
- Los errores de subida, descarga o exportación bloquean la entrega y muestran el archivo afectado; el intento continúa registrándose como fallido en `email_logs`.

### Plantilla de correo compartida

- F29, recordatorios de pago F29 y cobranza usan el mismo renderer HTML compatible con clientes de correo.
- Encabezado sobrio, logo existente con fallback de nombre, título, cliente, período/concepto, resumen, instrucciones, archivos/comprobantes, firma responsable y pie de respuesta.
- Cobranza muestra cliente, monto, vencimiento, servicio/concepto y el enlace HTTPS manual cuando existe, tanto en preview como en el correo enviado.
- El logo usa `BRAND_LOGO_URL` si está configurado; en Netlify cae a `URL/brand/logo-blanco.png` y finalmente al nombre `Netz Asesorías`.

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
- Validar en producción un envío F29 con Google Sheets/Excel y otro con imagen privada, comprobando el CID en Gmail/Outlook y el adjunto original. El entorno local no dispone de sesión Drive, storage privado ni Resend.
- Validar en producción una cobranza con enlace de pago activo; la vista local no contiene filas del ledger.
- División del bundle frontend; actualmente existe una advertencia no bloqueante sobre un chunk superior a 500 kB.

## Seguridad vigente

- Sin contraseñas SII ni claves de certificados.
- Secretos únicamente en Netlify/server-side.
- Adjuntos en bucket privado.
- Efectos auditados en `activity_log`.
- `invoices` es metadata placeholder, sin emisión.

## Verificación más reciente (20 de junio de 2026)

- `npx tsc --noEmit` sin errores (ejecutado como `npx.cmd` en Windows).
- Build Vite de producción exitoso; persiste la advertencia no bloqueante del chunk superior a 500 kB.
- 14 pruebas automatizadas exitosas, incluidas estructura F29, CID de comprobante y enlace de pago en la plantilla compartida.
- Verificación visual del compositor F29 en 1280×720 y 390×844: acciones visibles, área desplazable sin solapamiento y HTML final legible.
