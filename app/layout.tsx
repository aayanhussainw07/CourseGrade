import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { UserInfoBar } from "@/components/user-info-bar";

export const metadata: Metadata = {
  title: "CourseGrade",
  description: "A website to handle all your course grading needs.",
  icons: { icon: "/coursegrade.png" },
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
        <AuthProvider>
          <UserInfoBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
