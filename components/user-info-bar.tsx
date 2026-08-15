"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function UserInfoBar() {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return null;
  return (
    <div className="absolute top-3 right-3 z-50">
      <div className="flex items-center gap-1 rounded-full border border-border/80 bg-card/95 px-4 py-2">
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">
            {session?.user?.name || session?.user?.email || "Google User"}
          </p>
          <p className="text-xs text-muted-foreground">
            {session?.user?.email}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
