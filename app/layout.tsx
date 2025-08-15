import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Bingo Guilax - Jogue e Ganhe",
  description: "A melhor plataforma de bingo online do Brasil",
  keywords: "bingo, jogo, online, sorteio, prêmios, guilax",
  authors: [{ name: "Bingo Guilax" }],
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bingo Guilax",
  },
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" href="/pwa-guilax.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bingo Guilax" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileImage" content="/pwa-guilax.png" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
