import { Layout } from './components/Layout.jsx';
import { SEO } from './components/SEO.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { NosotrosPage } from './pages/NosotrosPage.jsx';
import { ServiciosPage } from './pages/ServiciosPage.jsx';
import { seo } from './data/seo.js';

const routes = {
  '/': { page: <HomePage />, seo: seo.home },
  '/nosotros': { page: <NosotrosPage />, seo: seo.nosotros },
  '/servicios': { page: <ServiciosPage />, seo: seo.servicios },
  '/contacto': { page: <ContactPage />, seo: seo.contacto },
};

function getRoute() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return routes[path] ?? routes['/'];
}

export default function App() {
  const current = getRoute();

  return (
    <Layout>
      <SEO {...current.seo} />
      {current.page}
    </Layout>
  );
}
