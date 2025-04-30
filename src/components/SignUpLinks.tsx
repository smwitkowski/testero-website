import Link from "next/link";

export function SignUpLinks() {
  return (
    <div className="mt-4 text-center">
      Already have an account? <Link href="/signin">Sign In</Link>
    </div>
  );
}