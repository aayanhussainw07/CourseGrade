import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

const siteTitle = "CourseGrade";
const siteUrl = "https://www.coursegrade.io";
const siteDescription =
  "Track grades, GPA, credits, and custom grade curves without wrestling another spreadsheet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  authors: [{ name: siteTitle }],
  creator: siteTitle,
  publisher: siteTitle,
  icons: {
    icon: [
      {
        url: "/coursegrade.png",
        type: "image/png",
        sizes: "2000x2000",
      },
    ],
    apple: [
      {
        url: "/coursegrade.png",
        type: "image/png",
        sizes: "2000x2000",
      },
    ],
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
