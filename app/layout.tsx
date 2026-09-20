import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Amboo Shaggaa Skate',
  description: 'Skate House Management System',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-light">
        <AuthProvider>
          <main className="container-fluid p-0">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
