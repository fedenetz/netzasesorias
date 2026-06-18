# Plan de proyecto · Control tributario interno Netz

Actualizado: 18 de junio de 2026
Fuente operativa: `Formulario 29.xlsx` (hojas 2026 y 2025)

## 1. Decisión de producto

La primera entrega productiva será el módulo mensual F29. La hoja Excel seguirá siendo una fuente de migración y respaldo durante la transición, pero Supabase será la fuente de verdad del flujo de trabajo. Renta/F22 conserva solo su estructura base hasta validar F29 durante ciclos mensuales reales.

El espacio interno vive bajo el mismo dominio y exige Google Login, perfil de empleado activo, RLS y validación en cada Function. `/control` es la entrada; `/f29/:year/:month`, `/clients` y `/clients/:rut` son rutas internas protegidas.

## 2. Lo aprendido del control actual

- Hojas anuales: 2026 y 2025.
- Aproximadamente 349 clientes en 2026.
- Validación real: 349 filas cliente en 2026 (348 RUT únicos) y 355 en 2025 (353 RUT únicos); 370 clientes únicos entre ambos años.
- Cobertura mensual real: enero–diciembre en 2026 y septiembre–diciembre en 2025.
- Identidad: Razón social, RUT y código `Conta`.
- Cada mes repite `Monto`, `Fecha` y `Ctrl`.
- Datos transversales: `Vence`, `Responsable` y `Obs`.
- Estados vigentes: A Cargada, B Error Dig., C Informada, D Pagada / Enviada, E Pendiente, F S/ Movi., G Postergado y H Rev. por Scarlen.
- Campos de correo pueden incorporarse después, cuando exista una política de uso y notificaciones.

### Corte validado · mayo 2026

- 348 clientes únicos después de consolidar el RUT duplicado.
- Estados: A 2, B 0, C 89, D 50, E 4, F 64, G 0, H 0 y 139 sin estado.
- Monto total registrado: $322.930.911.
- 139 períodos sin fecha y 9 clientes con observación.
- Junio–diciembre usan `.` como marcador futuro; quedan sin estado y no se cuentan como pendientes.

## 3. Regla de seguridad no negociable

`Clave` y `Rut y clave Cert. Digital` nunca se importan, registran, imprimen en logs, incluyen en reportes de error ni se envían al navegador. El importador solo deriva `clients.has_credentials: boolean` para indicar que existe un mecanismo externo de acceso. Las credenciales permanecen fuera de la base operacional.

La carga funciona en modo simulación por defecto. Es necesario indicar `--commit` y usar la service role exclusivamente en entorno administrativo para escribir en Supabase.

## 4. Modelo normalizado

### `clients`

- `rut` único y normalizado.
- `legal_name`.
- `accounting_code` (`Conta`).
- `assigned_user_id` cuando el responsable coincide con un perfil activo.
- `has_credentials` booleano sin contenido secreto.
- `drive_folder_id`, estado activo y timestamps.

### `f29_periods`

Una fila por cliente, año y mes:

- `client_id`, `year`, `month`.
- `amount`, `filed_date`.
- `status_code`, `status_label`.
- `due_day`.
- `responsible_user_id` y `responsible_name` como respaldo de migración.
- `observation`.
- `source_sheet`, `imported_at`, `created_at`, `updated_at`.

### Datos compartidos

`profiles`, `documents`, `observations` y `activity_log` son reutilizables por F29 y F22. `activity_log.f29_period_id` vincula cada edición de monto, fecha, estado, responsable u observación con sus valores anterior y nuevo.

## 5. Importación

Comando seguro:

```text
npm run import:f29 -- "Formulario 29.xlsx"
```

Genera un reporte sanitizado sin escribir en la base. Después de revisar conteos por hoja, clientes, períodos, estados y columnas sensibles ignoradas:

```text
npm run import:f29 -- "Formulario 29.xlsx" --commit
```

El proceso detecta encabezados y meses por nombre, normaliza RUT, fechas y montos, hace `upsert` de clientes por RUT y de períodos por `(client_id, year, month)`, resuelve responsables contra perfiles activos cuando es posible y registra el evento de importación. Si el mismo RUT aparece más de una vez, el reporte muestra la colisión; la fila posterior define el período y los datos del año más reciente definen la ficha del cliente.

## 6. MVP F29

### Dashboard `/f29/:year/:month`

- 12 KPI: total, ocho estados, monto total, sin fecha y con observaciones.
- Tabla: RUT, razón social, responsable, monto, fecha, estado, vence, observación, documentos y última actualización.
- Búsqueda por RUT/razón social.
- Filtros por estado, responsable y presencia de observación.
- Edición inline de responsable, monto, fecha, estado y observación.
- Registro de cada cambio en `activity_log`.
- Navegación al perfil del cliente.

### Perfil `/clients/:rut`

- Encabezado y responsable.
- Estado/monto F29 actual e historial mensual.
- Placeholder F22 anual claramente identificado.
- Documentos Drive, observaciones y actividad.

## 7. Fases y criterios de salida

1. **Importador y modelo**: dry-run coincide con filas útiles y meses de ambas hojas; cero secretos en salida, logs o base.
2. **Dashboard F29**: KPIs cuadran con `f29_periods`; búsqueda/filtros/edición validados con una cartera completa.
3. **Piloto mensual**: equipo usa el sistema en paralelo con Excel durante un período; diferencias documentadas y corregidas.
4. **Operación estable**: Supabase pasa a fuente de verdad; Excel queda solo como exportación/respaldo.
5. **Renta/F22**: se implementa reutilizando clientes, perfiles, documentos, observaciones y actividad después del piloto F29.

## 8. Validaciones pendientes con el archivo real

- Confirmar filas exactas de encabezado y celdas combinadas.
- Confirmar si todos los meses existen en ambas hojas.
- Determinar formato real de `Monto`, `Fecha`, `Vence` y valores vacíos de `Ctrl`.
- Medir duplicados o RUT inválidos.
- Confirmado en el archivo real: `Ctrl` vacío o `.` se conserva como “Sin estado”; nunca se transforma silenciosamente en E Pendiente.
- Validar nombres de responsables contra perfiles Google autorizados.
