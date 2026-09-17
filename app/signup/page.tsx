import { redirect } from "next/navigation";

// Public signup does not exist in Lal Motors BOS — employee accounts are
// created only by an Administrator via Employees. Any direct visit to
// /signup (bookmarked, linked, typed) is sent to /login instead of
// rendering a form the backend will reject anyway.
export default function SignupPage() {
  redirect("/login");
}
