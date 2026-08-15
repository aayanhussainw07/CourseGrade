import Image from "next/image";

export function AppScreenLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="-mx-4 -my-8 flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f5edea]"
    >
      <Image
        src="/coursegrade.png"
        alt=""
        width={56}
        height={56}
        priority
        className="h-14 w-14 animate-logo-float motion-reduce:animate-none"
      />
      <span className="text-sm font-medium text-muted-foreground">
        Loading...
      </span>
    </div>
  );
}
