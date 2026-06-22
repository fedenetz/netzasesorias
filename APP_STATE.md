# Estado actual de Netz Control

Fecha de corte: 22 de junio de 2026.

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
- La ficha documental abre en archivos relevantes de los últimos tres meses, agrupados por F29, Renta, comprobantes, legales, cobranza y otros; incluye filtros, módulo, fecha de indexación y marca de clasificación manual.

### F29

- Dashboard mensual denso con filtros rápidos.
- Estado dinámico: Cargada, Informada, Pagada/Enviada y pago vencido.
- Monto actual/anterior en CLP, control de pago tributario y recordatorios.
- RN Observaciones visible para todos y editable solamente por administradores.
- Fecha del primer email y fecha límite electrónica con fines de semana/feriados.
- Estado del Excel por cliente/período, recarga de la carpeta mensual y subida directa `.xls/.xlsx/.xlsm`, con estado por fila y auditoría.
- La carpeta mensual F29 es fuente autoritativa para asociar Excel aunque el nombre use solamente la razón social; el primer hallazgo o subida crea/clasifica el período como `Cargada`, deja auditoría y conserva controles de reindexación/corrección.
- Historial con próximos dos meses en prioridad visual baja, sin tratarlos como alertas.
- Las cuentas `accountant` ven y operan solamente los F29 vinculados a su identidad. La asignación resuelve primero `responsible_user_id`, luego el nombre operativo de `responsible_name` contra el perfil/safelist y finalmente `clients.assigned_user_id`.
- El mes se inicializa mediante RPC idempotente para los clientes F29 activos visibles al operador; la unicidad cliente/año/mes evita duplicados.
- Asociar un Excel deja el período en `Cargada`, solicita revisión administrativa y envía una sola notificación interna a control antes de contactar al cliente.
- El envío exitoso al cliente deja el período `Informada` y el pago pendiente; el pago se confirma manualmente mediante RPC auditada.
- Un job diario recuerda automáticamente los F29 informados e impagos un día antes del vencimiento, con idempotencia por período.
- El flujo mensual F29 abre en `Pendientes`: todo período clasificado y aún no pagado. `Sin movimiento` y `Sin estado` quedan ocultos por defecto, con filtros explícitos; el contador responsable debe clasificar los períodos sin estado.

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
- Filtros categóricos multiselección con casillas en Clientes, F29 y F22; las opciones de una categoría se combinan entre sí y las categorías se cruzan.
- Clientes, F29 y F22 ordenan por RUT inicialmente y permiten alternar ascendente/descendente desde cada encabezado de columna.
- El filtro `Alertas` agrupa observaciones y estados problemáticos: error, vencido/pago pendiente, postergado y revisión requerida cuando corresponda.
- Manifest de `Netz Control` y service worker instalable. Solo conserva manifest/icono; navegación, funciones y datos autenticados son network-only.
- El Resumen mantiene superficies, anillo de progreso, leyendas, bordes y textos secundarios con contraste consistente en dark mode.
- El control de densidad de la barra superior abre un selector explícito Compacta/Cómoda y ajusta tablas y tarjetas móviles.
- Dark mode fue auditado transversalmente en Resumen, Clientes, F29, F22, Facturación, Documentos, Actividad y Configuración, incluidos modales y estados móviles.
- Los controles residuales del modo oscuro (acciones de adjuntos, destinatarios recientes, paginación, selector de plan, checkboxes, badges y estados deshabilitados) usan superficies oscuras y contraste consistente.
- Facturación y métricas F29 redistribuyen su espacio en móvil/anchos estrechos; los errores internos ya no reservan una pantalla completa.
- Los responsables usan color solamente en el avatar. La cartera omite las columnas Documentos y acción redundante, conservando esos datos en filtros e inspector.

### Navegación

- Resumen, Clientes, F29, F22, Facturación, Documentos, Actividad y Configuración tienen rutas funcionales.
- Búsqueda global de clientes y acceso a auditoría desde la campana.
- Sidebar plegable en escritorio, con preferencia persistida y expansión completa en móvil.
- El compositor F29 usa el ancho recuperado con navegación de pasos a la derecha y una zona de adjuntos/Excel más amplia.

## Fuera de alcance o pendiente

- Emisión real de facturas/boletas mediante SII o SimpleAPI.
- Integración con proveedor de pagos.
- Recordatorios automáticos sin confirmación humana.
- Backfill histórico automático de honorarios.
- Calendario de feriados posteriores a 2027.
- Validar al menos un envío programado completo en el deploy real.
- Validar en producción un envío F29 con Google Sheets/Excel y otro con imagen privada, comprobando el CID en Gmail/Outlook y el adjunto original. El entorno local no dispone de sesión Drive, storage privado ni Resend.
- Validar en producción una cobranza con enlace de pago activo; la vista local no contiene filas del ledger.
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

Estado de producción confirmado por el usuario el 22 de junio de 2026: todas las migraciones hasta `20260627_f29_monthly_workflow.sql` están aplicadas.

- `20260623_operational_usability.sql`: metadata administrativa, fecha de escaneo Drive, procedencia/tipos documentales y metadata de plan/suscripción.
- `20260624_security_production_baseline.sql`: baseline de seguridad, permisos y diagnóstico de producción.
- `20260625_transversal_quality.sql`: permisos de mutación limitados al cliente asignado.
- `20260626_accountant_f29_assignment.sql`: alinea RLS F29 con el nombre operativo vinculado al perfil/safelist del contador.
- `20260627_f29_monthly_workflow.sql`: formaliza revisión, pago, inicialización mensual, metadatos de entrega e idempotencia de avisos F29.

## Verificación más reciente (22 de junio de 2026)

- `npx tsc --noEmit` sin errores (ejecutado como `npx.cmd` en Windows).
- Build Vite de producción exitoso. La carga administrativa es diferida y el bundle queda dividido en chunks inferiores a 500 kB, sin la advertencia anterior.
- 29 pruebas automatizadas exitosas, incluidas la resolución de responsables F29, la semántica de trabajo pendiente y los filtros del flujo formal/documentos recientes.
- `verify:production` exitoso el 22 de junio de 2026: configuración requerida, RLS, RPCs, enums, grants, tablas, columnas, storage privado, policies, triggers y migraciones validados contra producción.
- Auditoría visual en 8 rutas, desktop, móvil y ancho intermedio: sin desbordamiento horizontal, superficies dark consistentes, sidebar plegable, Facturación responsive y compositor F29 ampliado.
