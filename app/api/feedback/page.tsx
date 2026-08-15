import { redirect } from "next/navigation";

// The feedback board now lives in the Platform Admin overview.
export default function LegacyFeedbackPage() {
  redirect("/admin");
}
