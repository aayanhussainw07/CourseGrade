import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

const siteUrl = new URL("https://www.coursegrade.io");
const siteTitle = "CourseGrade";
const siteDescription =
  "Track grades, GPA, credits, and what-if scenarios without wrestling another spreadsheet.";
const socialImage = "/social-preview.png";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  authors: [{ name: siteTitle }],
  creator: siteTitle,
  publisher: siteTitle,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/coursegrade.png",
    apple: "/coursegrade.png",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: siteTitle,
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "CourseGrade grade tracking dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
