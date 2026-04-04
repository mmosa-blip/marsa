import { redirect } from "next/navigation";
export default function ProvidersRedirect() {
  redirect("/dashboard/users?role=EXTERNAL_PROVIDER");
}
