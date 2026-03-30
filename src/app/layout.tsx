import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rolling Connect — On-Demand Interpretation',
  description: 'OPI + VRI interpretation platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-brand-600 focus:ring-2 focus:ring-brand-500 focus:rounded-lg focus:shadow-lg text-sm font-medium"
        >
          Skip to main content
        </a>
        <Providers>
          <div className="flex-1 flex flex-col">
            {children}
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
