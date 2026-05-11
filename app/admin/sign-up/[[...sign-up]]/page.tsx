import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign up — Realscale admin" };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create admin account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the allowlisted admin email can access this area. Other emails will be
            blocked at sign-in.
          </p>
        </div>
        <SignUp routing="path" path="/admin/sign-up" signInUrl="/admin/sign-in" />
      </div>
    </div>
  );
}
