"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MarketingPage } from "@/components/marketing-page";
import { AdSenseLoader } from "@/components/adsense-loader";
import Image from "next/image";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    if (!showLoading) return null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Image
            src="/coursegrade.png"
            alt="CourseGrade"
            width={48}
            height={48}
            className="mx-auto mb-4 h-12 w-12 animate-pulse"
          />
          <p className="text-muted-foreground">Checking your account...</p>
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <>
      <AdSenseLoader />
      <MarketingPage />
    </>
  );
}
