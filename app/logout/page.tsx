import { signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LogoutPage() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
