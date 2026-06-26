"use server";

import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginWithCredentials(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return "Email and password are required.";
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return "Invalid email or password.";
    }
  } catch {
    return "Invalid email or password.";
  }

  redirect("/");
}
