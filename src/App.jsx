import { Layout } from './components/Layout.jsx';
import { SEO } from './components/SEO.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LegalPage } from './pages/LegalPage.jsx';
import { NosotrosPage } from './pages/NosotrosPage.jsx';
import { PrivacyPage } from './pages/PrivacyPage.jsx';
import { ResourcesPage } from './pages/ResourcesPage.jsx';
import { ServiceDetailPage } from './pages/ServiceDetailPage.jsx';
import { ServiciosPage } from './pages/ServiciosPage.jsx';
import { seo } from './data/seo.js';
import { getServiceBySlug } from './data/services.js';
import { AdminGate } from './admin/AdminGate.tsx';

const routes = {
  '/': { page: <HomePage />, seo: seo.home },
  '/nosotros': { page: <NosotrosPage />, seo: seo.nosotros },
  '/servicios': { page: <ServiciosPage />, seo: seo.servicios },
  '/recursos': { page: <ResourcesPage />, seo: seo.recursos },
  '/contacto': { page: <ContactPage />, seo: seo.contacto },
  '/aviso-legal': { page: <LegalPage />, seo: seo.avisoLegal },
  '/privacidad': { page: <PrivacyPage />, seo: seo.privacidad },
};

function getRoute() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path.startsWith('/servicios/')) {
    const slug = path.replace('/servicios/', '');
    const service = getServiceBySlug(slug);

    if (service) {
      return {
        page: <ServiceDetailPage service={service} />,
        seo: {
          title: `${service.name} | Netz Asesorias`,
          description: service.summary,
          path,
        },
      };
    }
  }

  return routes[path] ?? routes['/'];
}

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  if (path === '/admin') {
    window.history.replaceState({}, '', '/control');
    return <AdminGate />;
  }

  if (path.startsWith('/control') || path.startsWith('/f29/') || path.startsWith('/f22/') || path === '/clients' || path.startsWith('/clients/')) {
    return <AdminGate />;
  }

  const current = getRoute();

  return (
    <Layout>
      <SEO {...current.seo} />
      {current.page}
    </Layout>
  );
}
