import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-primary">
          404
        </p>
        <h1 className="font-futura-bold text-2xl font-black uppercase text-foreground">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page is not on the CourseGrade board.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md border border-primary/25 bg-[#fff8f1] px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Back to CourseGrade
        </Link>
      </div>
    </main>
  );
}
