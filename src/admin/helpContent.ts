export type HelpRole = 'admin' | 'accountant' | 'viewer';

export type HelpTourStep = {
  target: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export type HelpEntry = {
  title: string;
  summary: string;
  workflow: string[];
  statuses: Array<{ label: string; description: string }>;
  actions: string[];
  errors: string[];
  faq: Array<{ question: string; answer: string }>;
  roleNotes?: Partial<Record<HelpRole, string>>;
  tour?: HelpTourStep[];
};

export type HelpPageId = 'dashboard' | 'clients' | 'client' | 'f29' | 'f22' | 'billing' | 'documents' | 'activity' | 'settings' | 'viewer';

const operationalRoleNotes: HelpEntry['roleNotes'] = {
  accountant: 'Puedes operar períodos, revisar documentos, preparar correos, registrar pagos y gestionar cobranza según tus permisos.',
  admin: 'Puedes administrar usuarios, configuración y operaciones sensibles. Revisa los cambios antes de aplicarlos.',
};

export const helpContent: Record<HelpPageId, HelpEntry> = {
  dashboard: {
    title: 'Resumen de control',
    summary: 'Vista diaria de la cartera tributaria. Úsala para detectar bloqueos, períodos pendientes y trabajo prioritario.',
    workflow: ['Revisa los indicadores del período.', 'Abre los clientes que requieren atención.', 'Continúa la operación desde F29 mensual.'],
    statuses: [{ label: 'Bloqueado', description: 'Existe una condición que impide continuar.' }, { label: 'Pendiente', description: 'El período todavía requiere trabajo.' }, { label: 'Pagado / enviado', description: 'La operación principal quedó completada.' }],
    actions: ['Ir a F29 para trabajar el período actual.', 'Abrir un cliente desde la lista de atención.'],
    errors: ['No ignores bloqueos aunque el porcentaje general sea alto.', 'Confirma el período activo antes de operar.'],
    faq: [{ question: '¿Los indicadores incluyen toda la cartera?', answer: 'Usan los clientes visibles para tu sesión y el período activo.' }],
    roleNotes: operationalRoleNotes,
    tour: [{ target: '.metrics-grid', title: 'Estado del período', description: 'Estos indicadores resumen avance, pendientes y bloqueos.' }, { target: '.attention-list', title: 'Atención prioritaria', description: 'Abre desde aquí los casos que requieren revisión.' }],
  },
  clients: {
    title: 'Clientes',
    summary: 'Base operativa de clientes, responsables y servicios tributarios habilitados.',
    workflow: ['Busca por nombre, RUT o código Conta.', 'Verifica responsable y servicios asociados.', 'Abre la ficha para revisar períodos, contactos y documentos.'],
    statuses: [{ label: 'Activo', description: 'Cliente incluido en la operación vigente.' }, { label: 'Inactivo', description: 'Cliente conservado sin operación activa.' }],
    actions: ['Abrir la ficha completa.', 'Crear o editar un cliente si tus permisos lo permiten.'],
    errors: ['Evita duplicar clientes por diferencias de formato en el RUT.', 'Confirma responsable y correo antes de preparar comunicaciones.'],
    faq: [{ question: '¿Dónde están los contactos?', answer: 'Dentro de la ficha del cliente, en la pestaña Contactos.' }],
    roleNotes: operationalRoleNotes,
  },
  client: {
    title: 'Ficha del cliente',
    summary: 'Concentra datos administrativos, períodos F29/F22, documentos, contactos, cobranza y actividad de un cliente.',
    workflow: ['Confirma RUT y responsable.', 'Revisa el período y las observaciones.', 'Consulta contactos y documentos antes de enviar.', 'Usa Actividad para comprobar cambios.'],
    statuses: [{ label: 'Período actual', description: 'Estado F29 correspondiente al mes seleccionado.' }, { label: 'Sin clasificar', description: 'Documento indexado que aún requiere tipo.' }],
    actions: ['Preparar email F29 cuando existe un período.', 'Escanear Drive, editar datos o revisar contactos.', 'Consultar cobros relacionados.'],
    errors: ['Sin carpeta Drive no se puede sincronizar documentación.', 'Un período inexistente deshabilita el correo F29.'],
    faq: [{ question: '¿Por qué no aparece un archivo?', answer: 'Escanea el árbol de Drive y revisa la ruta y los filtros documentales.' }],
    roleNotes: operationalRoleNotes,
  },
  f29: {
    title: 'F29 · Operaciones',
    summary: 'Control mensual por cliente para declaración, comunicación y pago. Prioriza alertas, errores y pagos pendientes antes de enviar correos.',
    workflow: ['Confirma mes y año.', 'Filtra pendientes, errores o responsables.', 'Abre un cliente en el inspector.', 'Revisa estado, monto y documento.', 'Envía F29 o recuerda el pago solo después de validar.'],
    statuses: [
      { label: 'Cargada', description: 'Información cargada y lista para revisión.' },
      { label: 'En revisión', description: 'El período necesita validación antes de continuar.' },
      { label: 'Error Dig.', description: 'Existe un error de digitación o datos que debe corregirse.' },
      { label: 'Informada', description: 'La declaración fue informada o comunicada.' },
      { label: 'Pagada / Enviada', description: 'Declaración pagada y comunicación completada.' },
      { label: 'Postergado', description: 'La operación fue aplazada y requiere seguimiento.' },
      { label: 'Sin pago', description: 'No existe un monto de pago para el período.' },
      { label: 'Pendiente', description: 'Hay monto por pagar y aún no se registra el pago.' },
    ],
    actions: ['Enviar F29 desde el inspector cuando el período y destinatario estén validados.', 'Usar Recordar pago solo si existe monto pendiente.', 'Abrir Documentos para recargar o subir el Excel del período.', 'Abrir Ficha completa para contactos e historial.'],
    errors: ['Destinatario o reply-to faltante.', 'Adjunto inválido o documento no encontrado.', 'Drive sin autorización o exportación fallida.', 'Email demorado o rebotado: revisa el estado antes de reenviar.', 'Duplicar recordatorios sin revisar el último envío.'],
    faq: [{ question: '¿Cuándo uso Email?', answer: 'Cuando el período está cargado, el contenido fue revisado y los destinatarios son correctos.' }, { question: '¿Cuándo uso Recordar pago?', answer: 'Solo cuando hay monto pendiente, el cliente no está pagado y revisaste el último recordatorio.' }],
    roleNotes: operationalRoleNotes,
    tour: [
      { target: '.f29-ops-kpis', title: 'Resumen mensual', description: 'Mide cartera, montos, emails y pagos pendientes.' },
      { target: '.f29-toolbar', title: 'Búsqueda y filtros', description: 'Aísla errores, pendientes, responsables o casos observados.' },
      { target: '.command-table-scroll, .f29-mobile-list', title: 'Lista operativa', description: 'Cada fila representa un cliente en el período seleccionado.' },
      { target: '.operation-inspector', title: 'Inspector', description: 'Al abrir una fila, valida estado, monto, documentos y acciones aquí.' },
    ],
  },
  f22: {
    title: 'Renta / F22',
    summary: 'Seguimiento anual de preparación, revisión y resultado de renta por cliente.',
    workflow: ['Confirma el año tributario.', 'Filtra la cartera.', 'Revisa antecedentes y estado.', 'Registra resultados y observaciones.'],
    statuses: [{ label: 'Pendiente', description: 'Faltan antecedentes o trabajo.' }, { label: 'En revisión', description: 'Los datos requieren validación.' }, { label: 'Declarado', description: 'La declaración fue presentada.' }],
    actions: ['Actualizar campos operativos.', 'Abrir la ficha del cliente para contexto adicional.'],
    errors: ['No mezcles año calendario con año tributario.', 'Verifica montos antes de marcar como declarado.'],
    faq: [{ question: '¿Dónde veo documentos del cliente?', answer: 'En su ficha o en la pantalla Documentos.' }],
    roleNotes: operationalRoleNotes,
  },
  billing: {
    title: 'Facturación y pagos',
    summary: 'Control de honorarios, vencimientos, pagos, enlaces externos y recordatorios manuales.',
    workflow: ['Filtra vencidos y pendientes.', 'Confirma monto, vencimiento y último recordatorio.', 'Envía el recordatorio o copia el enlace.', 'Registra el pago cuando esté confirmado.'],
    statuses: [{ label: 'Pendiente', description: 'Cobro creado y aún no pagado.' }, { label: 'Enviado', description: 'La comunicación de cobro fue enviada.' }, { label: 'Vencido', description: 'La fecha pasó sin pago registrado.' }, { label: 'Pagado', description: 'Pago confirmado y registrado.' }],
    actions: ['Crear un cobro.', 'Enviar recordatorio.', 'Guardar o copiar un enlace HTTPS externo.', 'Marcar pagado o reabrir.'],
    errors: ['No registres un pago sin confirmación.', 'Evita duplicar recordatorios: revisa la fecha del último.', 'El enlace de pago debe existir previamente y usar HTTPS.'],
    faq: [{ question: '¿El enlace genera una factura?', answer: 'No. Solo guarda un enlace externo ya creado.' }],
    roleNotes: operationalRoleNotes,
    tour: [{ target: '.billing-kpis', title: 'Resumen de cobranza', description: 'Prioriza montos vencidos y clientes impagos.' }, { target: '.billing-table', title: 'Ledger de cobros', description: 'Filtra, recuerda, enlaza o registra pagos desde esta lista.' }],
  },
  documents: {
    title: 'Documentos',
    summary: 'Índice de archivos encontrados en Drive, con clasificación, cliente, ruta y fecha de modificación.',
    workflow: ['Busca por archivo, ruta, cliente o RUT.', 'Verifica el origen de la clasificación.', 'Corrige el tipo si corresponde.', 'Abre el archivo original en Drive.'],
    statuses: [{ label: 'Inferido', description: 'Tipo propuesto por nombre, extensión o ruta.' }, { label: 'Manual', description: 'Tipo confirmado o cambiado por una persona.' }, { label: 'Archivo privado', description: 'Adjunto almacenado de forma privada; se entrega con acceso temporal.' }],
    actions: ['Filtrar por tipo.', 'Clasificar manualmente.', 'Abrir en Drive.'],
    errors: ['Si falta un archivo, escanea Drive desde la ficha del cliente.', 'Revisa carpeta, permisos y ruta antes de reclasificar.'],
    faq: [{ question: '¿Por qué un archivo no aparece?', answer: 'Puede faltar un escaneo, permiso de Drive o vínculo con el cliente.' }],
    roleNotes: operationalRoleNotes,
  },
  activity: {
    title: 'Actividad',
    summary: 'Trazabilidad de cambios operativos realizados en clientes, períodos y documentos.',
    workflow: ['Busca por cliente o acción.', 'Revisa actor y fecha.', 'Abre la ficha relacionada cuando necesites contexto.'],
    statuses: [{ label: 'Registro auditado', description: 'Evento persistido para trazabilidad.' }],
    actions: ['Buscar eventos.', 'Usar la ficha del cliente para revisar el estado actual.'],
    errors: ['La actividad explica cambios; no reemplaza la revisión del estado actual.'],
    faq: [{ question: '¿Puedo editar un evento?', answer: 'No. La actividad es un registro de consulta.' }],
    roleNotes: operationalRoleNotes,
  },
  settings: {
    title: 'Equipo y acceso',
    summary: 'Administración de correos autorizados, roles y vínculo entre empleados y responsables operativos.',
    workflow: ['Verifica el correo corporativo.', 'Asigna el rol mínimo necesario.', 'Haz coincidir el nombre con el responsable F29.', 'Confirma que el acceso quede activo.'],
    statuses: [{ label: 'Administrador', description: 'Gestiona usuarios, configuración y operaciones sensibles.' }, { label: 'Contador', description: 'Opera clientes, períodos, documentos y cobranza según permisos.' }, { label: 'Solo lectura', description: 'Consulta información sin editar ni enviar.' }, { label: 'Primer ingreso pendiente', description: 'Correo autorizado que aún no vinculó su cuenta Google.' }],
    actions: ['Autorizar un correo.', 'Editar rol, nombre operativo o acceso.'],
    errors: ['Un rol excesivo amplía el alcance de acciones sensibles.', 'Un nombre distinto al usado en F29 rompe el vínculo con el responsable.'],
    faq: [{ question: '¿Qué es la safelist?', answer: 'La lista de correos habilitados para iniciar sesión como empleados.' }],
    roleNotes: { admin: 'Puedes administrar usuarios y roles. Revisa correo, rol y estado antes de guardar.' },
  },
  viewer: {
    title: 'Consulta · solo lectura',
    summary: 'Vista de consulta del estado operativo. No incluye acciones que cambien datos o envíen comunicaciones.',
    workflow: ['Busca el cliente en la tabla.', 'Revisa estado F29, monto, email y pago.', 'Solicita a un contador o administrador cualquier cambio.'],
    statuses: [{ label: 'Solo lectura', description: 'Puedes revisar información sin modificarla.' }, { label: 'Pendiente', description: 'La operación aún requiere acción del equipo.' }, { label: 'Pagado', description: 'El pago se encuentra registrado.' }],
    actions: ['Consultar la cartera visible.', 'Cerrar sesión al terminar.'],
    errors: ['No interpretes la falta de botones como un error: corresponde a tu rol.'],
    faq: [{ question: '¿Por qué no puedo editar o enviar?', answer: 'Tu rol actual es solo lectura. Un administrador puede revisar tu acceso.' }],
    roleNotes: { viewer: 'Tu rol actual es solo lectura. Puedes revisar información, pero no enviar correos, subir documentos ni modificar estados.' },
  },
};

export const onboardingItems = [
  'Revisar clientes activos',
  'Abrir F29 del mes',
  'Filtrar pendientes o errores',
  'Abrir un cliente en el inspector',
  'Preparar un email de prueba',
  'Revisar facturación y pagos',
  'Revisar documentos',
];
