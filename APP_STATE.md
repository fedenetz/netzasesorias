# Estado actual de Netz Control

Fecha de corte: 21 de junio de 2026.

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
- Recarga por cliente con cantidad, fecha de revisión y sugerencia solo si está pendiente o tiene más de 24 horas.
- Clasificación inferida por nombre, extensión y ruta, con override manual distinguido y auditado.
- Ficha administrativa editable: régimen, tipo jurídico, representante, actividad, dirección, teléfono, banco, cuenta y contabilidad.

### F29

- Dashboard mensual denso con filtros rápidos.
- Estado dinámico: Cargada, Informada, Pagada/Enviada y pago vencido.
- Monto actual/anterior en CLP, control de pago tributario y recordatorios.
- RN Observaciones visible para todos y editable solamente por administradores.
- Fecha del primer email y fecha límite electrónica con fines de semana/feriados.
- Estado del Excel por cliente/período, recarga de la carpeta mensual y subida directa `.xls/.xlsx/.xlsm`, con estado por fila y auditoría.
- Historial con próximos dos meses en prioridad visual baja, sin tratarlos como alertas.
- Las cuentas `accountant` ven y operan solamente los F29 vinculados a su identidad. La asignación resuelve primero `responsible_user_id`, luego el nombre operativo de `responsible_name` contra el perfil/safelist y finalmente `clients.assigned_user_id`.
- El flujo mensual F29 separa `Pendiente`, `Cargada`, `Informada`, `Pagada` y `Sin estado`; el contador debe resolver los períodos sin estado. `Sin movimiento` queda oculto por defecto al abrir o cambiar de mes y conserva un filtro explícito.

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
- Resumen en la ficha: plan/servicio, suscripción, deuda, último pago, recordatorio y enlace.

### Interfaz e instalabilidad

- Tablas compactas, mejor contraste, truncado con detalle y tarjetas apiladas en móvil.
- Filtros compactos para búsqueda, responsable, F29, billing y documentos.
- Manifest de `Netz Control` y service worker instalable. Solo conserva manifest/icono; navegación, funciones y datos autenticados son network-only.
- El Resumen mantiene superficies, anillo de progreso, leyendas, bordes y textos secundarios con contraste consistente en dark mode.
- El control de densidad de la barra superior abre un selector explícito Compacta/Cómoda y ajusta tablas y tarjetas móviles.

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
- La recarga/subida enfocada requiere un escaneo previo del árbol Drive para localizar la carpeta exacta del período.

## Seguridad vigente

- Sin contraseñas SII ni claves de certificados.
- Secretos únicamente en Netlify/server-side.
- Adjuntos en bucket privado.
- Efectos auditados en `activity_log`.
- `invoices` es metadata placeholder, sin emisión.
- La subida F29 exige autorización Google Drive de lectura/escritura; el token no se persiste y debe corresponder al empleado autenticado.
- La PWA no ofrece datos privados offline ni cachea respuestas autenticadas.

## Migraciones nuevas

- `20260623_operational_usability.sql`: metadata administrativa, fecha de escaneo Drive, procedencia/tipos documentales y metadata de plan/suscripción.
- `20260624_security_production_baseline.sql`: baseline de seguridad, permisos y diagnóstico de producción.
- `20260625_transversal_quality.sql`: permisos de mutación limitados al cliente asignado.
- `20260626_accountant_f29_assignment.sql`: alinea RLS F29 con el nombre operativo vinculado al perfil/safelist del contador.

## Verificación más reciente (21 de junio de 2026)

- `npx tsc --noEmit` sin errores (ejecutado como `npx.cmd` en Windows).
- Build Vite de producción exitoso; persiste la advertencia no bloqueante del chunk superior a 500 kB.
- 27 pruebas automatizadas exitosas, incluidas la resolución de responsables F29 por nombre operativo y la separación de etapas del flujo mensual.
- Verificación visual de F29 en desktop y móvil: filtro inicial sin `Sin movimiento`, contador Pendiente exclusivo, líneas dark mode corregidas y selector de densidad funcional.
