import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COURSE_ROSTER_ENABLED } from "@/lib/feature-flags";

export default function RosterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (COURSE_ROSTER_ENABLED) return children;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Course Roster is temporarily unavailable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re working on this feature and will bring it back soon.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
