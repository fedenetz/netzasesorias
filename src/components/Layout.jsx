import { company } from '../data/company.js';
import { Header } from './Header.jsx';
import { Footer } from './Footer.jsx';
import { WhatsAppFab } from './WhatsAppFab.jsx';

export function Layout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <WhatsAppFab />
      <Footer company={company} />
    </>
  );
}
