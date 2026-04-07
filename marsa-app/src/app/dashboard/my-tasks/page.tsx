import { redirect } from "next/navigation";

// This route now redirects to the unified executor-city page where the
// tasks list is available via the "مهامي" toggle.
export default function MyTasksRedirect() {
  redirect("/dashboard/executor-city");
}
