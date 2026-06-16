import { company } from '../data/company.js';
import { Header } from './Header.jsx';
import { Footer } from './Footer.jsx';

export function Layout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer company={company} />
    </>
  );
}
