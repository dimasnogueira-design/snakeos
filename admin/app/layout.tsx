import './globals.css';
import type { Metadata, Viewport } from 'next';
import RegisterWorker from './RegisterWorker';

export const metadata: Metadata = {
  title: 'SNAKE CONTROL',
  description: 'Central de controle do SNAKE OS',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' }
};
export const viewport: Viewport = { themeColor: '#070a0a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><RegisterWorker/>{children}</body></html>;
}
