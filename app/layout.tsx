import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'

export const metadata: Metadata = {
  title: 'CourseGrade',
  description: 'A website to handle all your course grading needs.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const adSenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

  return (
    <html lang="en">
      <body className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        {adSenseClient ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            data-ad-client={adSenseClient}
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
          />
        ) : null}
      </body>
    </html>
  )
}
