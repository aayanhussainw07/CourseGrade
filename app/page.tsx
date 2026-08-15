import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MarketingPage } from "@/components/marketing-page";
import { AdSenseLoader } from "@/components/adsense-loader";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <>
      <AdSenseLoader />
      <MarketingPage />
    </>
  );
}
