import './globals.css';
import { Nav } from '../components/Nav';

export const metadata = {
  title: 'IOTX Coinbase Bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
