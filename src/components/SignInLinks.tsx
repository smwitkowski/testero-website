import Link from "next/link";

export function SignInLinks() {
  return (
    <>
      <div className="mt-4">
        <Link href="/forgot-password">Forgot Password</Link>
      </div>
      <div className="mt-4">
        Don't have an account? <Link href="/signup">Sign Up</Link>
      </div>
    </>
  );
}