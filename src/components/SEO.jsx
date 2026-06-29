import { useEffect } from 'react';
import { absoluteUrl } from '../data/seo.js';
import { company } from '../data/company.js';
import { services } from '../data/services.js';

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

export function SEO({ title, description, path }) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(path);
    const socialImage = absoluteUrl('/brand/logo-negro.png');
    document.title = title;

    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'Logo de Netz Asesorías' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage });
    setMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: 'Logo de Netz Asesorías' });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    let schema = document.getElementById('local-business-schema');
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'local-business-schema';
      schema.type = 'application/ld+json';
      document.head.appendChild(schema);
    }

    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': ['AccountingService', 'ProfessionalService', 'LocalBusiness'],
      name: company.name,
      legalName: company.formalName,
      url: absoluteUrl('/'),
      telephone: company.phone,
      email: company.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Anibal Pinto 215, oficina 409',
        addressLocality: 'Concepcion',
        addressRegion: 'Region del Biobio',
        addressCountry: 'CL',
      },
      areaServed: company.publicArea,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: company.phone,
        email: company.email,
        contactType: 'customer service',
        areaServed: 'CL',
        availableLanguage: 'es',
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Servicios Netz Asesorias',
        itemListElement: services.map((service) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.name,
            description: service.summary,
            url: absoluteUrl(`/servicios/${service.slug}`),
          },
        })),
      },
    });
  }, [description, path, title]);

  return null;
}
