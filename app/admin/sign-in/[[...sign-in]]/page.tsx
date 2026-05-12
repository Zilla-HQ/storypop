import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in — StoryPop admin" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">StoryPop admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the allowlisted admin email can access this area.
          </p>
        </div>
        <SignIn routing="path" path="/admin/sign-in" signUpUrl="/admin/sign-up" />
      </div>
    </div>
  );
}
