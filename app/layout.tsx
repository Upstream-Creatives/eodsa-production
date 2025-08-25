import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/simple-toast";
import { AlertProvider } from "@/components/ui/custom-alert";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Avalon",
  description: "Avalon - Competition Management System - Register, compete, and manage dance competitions",
};

// Component to safely render external analytics
function SafeAnalytics() {
  try {
    return <Analytics />;
  } catch (error) {
    console.warn('⚠️ Analytics failed to load:', error);
    return null;
  }
}

function SafeSpeedInsights() {
  try {
    return <SpeedInsights />;
  } catch (error) {
    console.warn('⚠️ Speed Insights failed to load:', error);
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to external domains for better performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://vitals.vercel-analytics.com" />
        
        {/* DNS prefetch for better connectivity in different regions */}
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://api.cloudinary.com" />
        
        {/* Meta tags for better mobile and regional support */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <ErrorBoundary>
          <AlertProvider>
            <ToastProvider>
              <ErrorBoundary fallback={
                <div className="min-h-screen bg-black text-white flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Loading...</h1>
                    <p className="text-gray-400">If this takes too long, please refresh the page.</p>
                  </div>
                </div>
              }>
                {children}
              </ErrorBoundary>
            </ToastProvider>
          </AlertProvider>
        </ErrorBoundary>
        
        {/* Safely load analytics with error boundaries */}
        <Suspense fallback={null}>
          <SafeAnalytics />
        </Suspense>
        <Suspense fallback={null}>
          <SafeSpeedInsights />
        </Suspense>
        
        {/* Add a global error handler for unhandled script errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                console.error('🚨 Global error caught:', e.error || e.message);
                if (e.filename && e.filename.includes('google') || 
                    e.filename && e.filename.includes('vercel') ||
                    e.message && e.message.includes('Script error')) {
                  console.warn('⚠️ External script error - this is likely due to connectivity issues');
                }
              });
              
              window.addEventListener('unhandledrejection', function(e) {
                console.error('🚨 Unhandled promise rejection:', e.reason);
              });
              
              // Log connection info for debugging
              if (navigator.connection) {
                console.log('🌐 Connection info:', {
                  effectiveType: navigator.connection.effectiveType,
                  downlink: navigator.connection.downlink,
                  rtt: navigator.connection.rtt
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
