# Plan de accion para mejorar netzasesorias.cl

Fecha de analisis: 2026-06-16

## 1. Diagnostico ejecutivo

La web actual ya tiene una base correcta: tono sobrio, identidad aplicada, paginas Home/Nosotros/Servicios/Contacto, contenido centralizado en `src/data`, metadata basica, sitemap y una oferta de servicios clara.

El mayor desafio no es rehacerla completa, sino transformarla de una buena landing institucional en una web corporativa de confianza. El informe estrategico pide que Netz comunique continuidad profesional, criterio tecnico, orden, cumplimiento y cercania directa. La web actual avanza en esa direccion, pero todavia le faltan senales fuertes de prueba institucional, profundidad por servicio, recursos tecnicos y conversion real.

## 2. Hallazgos principales

1. La home comunica bien el rubro, pero el primer viewport todavia se siente mas como landing que como firma corporativa. El hero es grande, el CTA es muy dominante y la prueba de confianza queda demasiado abajo, especialmente en mobile.
2. El logo del header se ve demasiado pequeno en desktop y mobile. Eso reduce presencia de marca.
3. La seccion de testimonios muestra placeholders publicos. Esto debe retirarse u ocultarse hasta tener testimonios reales autorizados.
4. Servicios existe como pagina general, pero no hay paginas individuales para Contabilidad, F29, F22, Remuneraciones, Honorarios, etc. Esto limita confianza, SEO y capacidad de explicar alcance.
5. No existe seccion de Recursos/Actualidad tributaria y laboral, que el informe identifica como una prueba clave de autoridad.
6. Nosotros cuenta historia y valores, pero no muestra responsables visibles, cargos, credenciales o una senal humana verificable.
7. El formulario de contacto no envia realmente una solicitud; solo muestra un mensaje temporal. Antes de publicar, debe conectarse a correo corporativo, Netlify Forms u otro backend.
8. El footer legal incluye razon social y RUT, lo cual es positivo, pero faltan politica de privacidad, tratamiento de datos, disclaimer profesional y enlaces legales.
9. La web usa imagenes placeholder. Para una firma que compite por confianza, conviene reemplazarlas por fotografia real sobria o, al menos, piezas visuales mas corporativas y menos genericas.
10. El SEO tecnico esta iniciado, pero faltan breadcrumbs, schema por tipo de pagina, FAQPage en preguntas frecuentes, Article para recursos y sitemap ampliado.

## 3. Objetivo del redisenio incremental

Convertir netzasesorias.cl en una web corporativa sobria y confiable para una firma chilena de asesoria contable, tributaria y laboral, con continuidad profesional desde 1984, atencion directa y criterio tecnico aplicado a empresas, emprendedores, profesionales y personas naturales.

La web debe responder en menos de cinco segundos:

- Que hace Netz.
- Para quien trabaja.
- Por que es confiable.
- Como iniciar una conversacion.

## 4. Prioridad 1: confianza visible antes de agregar mas marketing

Plazo sugerido: 1 a 3 dias.

Acciones:

- Ajustar header para que el logo tenga mayor presencia y legibilidad.
- Reescribir el hero para alinearlo con el informe:
  - H1 sugerido: "Asesoria contable, tributaria y laboral para operar con orden y tranquilidad."
  - Bajada: "Acompanamos a empresas y profesionales con una mirada tecnica, directa y responsable."
- Reducir altura del hero en mobile para que la barra de confianza aparezca antes.
- Cambiar CTA principal a un tono menos agresivo:
  - "Hablar con Netz"
  - "Ver servicios"
- Mover senales de confianza cerca del primer viewport:
  - Trayectoria desde 1984.
  - Razon social.
  - Oficina en Concepcion.
  - Servicios contable, tributario y laboral.
- Ocultar la seccion de testimonios hasta tener citas reales autorizadas.
- Reemplazar placeholders visibles por imagenes reales o visuales institucionales mas sobrios.

Criterio de exito:

- En desktop y mobile se entiende el posicionamiento sin hacer scroll largo.
- No hay textos temporales visibles.
- La marca se ve mas solida y menos pequena.

## 5. Prioridad 2: paginas de servicio profundas

Plazo sugerido: 3 a 7 dias.

Crear paginas individuales para:

- Asesoria contable.
- Asesoria tributaria.
- IVA / Formulario 29.
- Operacion Renta / Formulario 22.
- Declaraciones Juradas.
- Remuneraciones y obligaciones laborales.
- Inicio de actividades, modificaciones y termino de giro.
- Acompanamiento ante instituciones.
- Certificados e informes contables.

Estructura recomendada para cada pagina:

- Hero breve con problema y resultado esperado.
- Para quien es.
- Que incluye.
- Que antecedentes se necesitan.
- Como trabaja Netz.
- Preguntas frecuentes.
- CTA institucional.

Acciones tecnicas:

- Crear rutas en `src/App.jsx`.
- Ampliar `src/data/services.js` con `title`, `metaDescription`, `includes`, `requirements`, `faqs` y `relatedServices`.
- Agregar breadcrumbs.
- Actualizar `src/data/seo.js`.
- Actualizar `public/sitemap.xml`.

Criterio de exito:

- Cada servicio puede posicionarse en Google por una busqueda especifica.
- Un cliente entiende el alcance antes de contactar.
- La oferta deja de depender de una sola pagina general.

## 6. Prioridad 3: pagina Firma/Nosotros con prueba humana

Plazo sugerido: 2 a 5 dias, sujeto a validacion interna.

Acciones:

- Validar documentalmente la historia 1984 -> 1998 -> 2022.
- Confirmar que cargos, nombres y credenciales se pueden publicar.
- Agregar bloque "Responsables" o "Direccion profesional".
- Incluir al menos:
  - Nombre.
  - Cargo.
  - Rol frente al cliente.
  - Especialidad.
  - Credencial o experiencia verificable, si aplica.
- Reforzar la historia como continuidad de criterio, no solo antiguedad.

Criterio de exito:

- La web deja de sentirse anonima.
- El usuario sabe quien esta detras de la asesoria.
- La historia desde 1984 aparece como respaldo real, no como claim decorativo.

## 7. Prioridad 4: Recursos tributarios y laborales

Plazo sugerido: 1 a 2 semanas para primera version.

Crear una seccion `/recursos` con articulos breves y practicos basados en fuentes oficiales.

Primer paquete recomendado:

- Guia practica del Formulario 29.
- Errores frecuentes antes de Operacion Renta.
- Que revisar antes de emitir boletas de honorarios.
- Calendario tributario mensual.
- Libro de Remuneraciones Electronico explicado simple.
- Checklist tributario para pymes.

Fuentes base:

- SII.
- Direccion del Trabajo.
- Tesoreria General de la Republica.
- ChileAtiende cuando corresponda.

Acciones tecnicas:

- Crear `src/data/resources.js`.
- Crear pagina `RecursosPage.jsx`.
- Crear pagina o template de articulo.
- Agregar schema `Article`.
- Agregar enlaces cruzados desde servicios a recursos.

Criterio de exito:

- Netz demuestra criterio tecnico con contenido propio.
- La web gana superficie SEO.
- Los recursos ayudan a educar sin prometer soluciones absolutas.

## 8. Prioridad 5: contacto real, legal y conversion

Plazo sugerido: 1 a 3 dias una vez definidos los datos.

Acciones:

- Crear correo corporativo `@netzasesorias.cl`.
- Definir si WhatsApp sera canal oficial.
- Conectar formulario con Netlify Forms, email transaccional o backend.
- Agregar validacion antispam.
- Agregar politica de privacidad.
- Agregar aviso de tratamiento de datos personales.
- Agregar disclaimer: la informacion del sitio es general y no reemplaza una revision profesional del caso.
- Confirmar si el RUT se mantiene publicado.

Criterio de exito:

- El formulario envia solicitudes reales.
- El sitio transmite seriedad legal.
- El cliente sabe que datos entrega y con que finalidad.

## 9. Prioridad 6: diseno y experiencia visual

Plazo sugerido: 3 a 7 dias.

Acciones:

- Mantener estilo institucional, pero reducir sensacion de plantilla.
- Usar fotografia real de oficina, documentos, ciudad o equipo cuando este disponible.
- Evitar imagenes de stock evidentes.
- Reducir bloques muy altos en mobile.
- Revisar tamanos de texto en botones y cards.
- Mantener contraste AA y foco visible.
- Hacer que los CTAs sean claros, pero menos "venta rapida".

Criterio de exito:

- La web se siente sobria, actual y chilena.
- No parece fintech, startup generica ni multinacional sobreactuada.
- Mobile permite leer y contactar sin friccion.

## 10. Prioridad 7: SEO tecnico y medicion

Plazo sugerido: 2 a 4 dias.

Acciones:

- Ampliar metadata por pagina.
- Agregar JSON-LD:
  - Organization.
  - ProfessionalService.
  - LocalBusiness.
  - BreadcrumbList.
  - FAQPage.
  - Article.
- Agregar Open Graph image.
- Actualizar sitemap con nuevas paginas.
- Revisar canonical por ruta.
- Medir eventos:
  - clic en telefono.
  - clic en CTA principal.
  - envio de formulario.
  - visitas a paginas de servicio.
  - lectura de recursos.
- Configurar GA4 o alternativa liviana.

Criterio de exito:

- Lighthouse alto en performance, accessibility y SEO.
- Google puede entender servicios y ubicacion.
- Se pueden medir consultas calificadas, no solo visitas.

## 11. Roadmap sugerido

Semana 1:

- Ajustar hero, header, confianza visible y testimonios.
- Conectar contacto o definir canal temporal serio.
- Reforzar footer legal basico.

Semana 2:

- Crear paginas individuales de servicios prioritarios.
- Agregar breadcrumbs, SEO y sitemap ampliado.
- Validar historia y responsables visibles.

Semana 3:

- Crear seccion Recursos.
- Publicar 3 a 6 contenidos iniciales.
- Agregar schema Article y FAQPage.

Semana 4:

- Reemplazar visuales placeholder.
- QA mobile, accesibilidad, performance y conversion.
- Configurar medicion y revisar consultas reales.

## 12. Decisiones pendientes

- Correo corporativo definitivo: usar `richard@ainahue.cl` como correo temporal hasta solicitar cambio.
- WhatsApp publico: si, publicar como canal visible.
- Credenciales y cargos publicables: dejar placeholders hasta tener acceso a informacion validada.
- Texto legal final: generar una version acorde para publicacion inicial y futura revision.
- Politica de privacidad: generar una version acorde para publicacion inicial y futura revision.
- Fotografias reales o linea visual sin rostros: usar linea visual sin rostros.
- Testimonios/casos autorizados: dejar placeholders hasta contar con autorizacion.
- Alcance editorial de Recursos: la administracion de la web quedara a cargo del propietario; pendientes y ajustes se trabajaran continuamente.

## 15. Ejecucion inicial aplicada

- Email temporal y WhatsApp publicados en contacto y footer.
- Formulario preparado para Netlify Forms con canal alternativo por email y WhatsApp.
- Paginas de aviso legal y politica de privacidad creadas.
- Seccion Recursos creada con primer paquete editorial base.
- Rutas individuales por servicio creadas.
- Servicio de honorarios y boletas electronicas agregado.
- Header actualizado con acceso a Recursos.
- Hero ajustado hacia un tono mas corporativo y menos agresivo.
- Responsables visibles agregados como placeholders controlados.
- Sitemap ampliado con servicios, recursos y paginas legales.

## 13. Indicadores de exito

- Mas consultas calificadas desde paginas internas.
- Mayor tiempo de lectura en servicios.
- Clics en telefono/contacto desde mobile.
- Navegacion desde Home hacia Servicios y Recursos.
- Feedback cualitativo: la web se percibe seria, clara y confiable.
- Sin placeholders visibles.
- Sin claims no validados.

## 14. Primera accion recomendada

Empezar por un sprint corto de confianza:

1. Ajustar hero y header.
2. Subir prueba institucional al primer tramo.
3. Ocultar testimonios placeholder.
4. Reforzar footer legal y contacto.
5. Crear la primera pagina individual de servicio como modelo.

Ese sprint cambia rapidamente la percepcion del sitio y deja una base replicable para el resto de paginas.
