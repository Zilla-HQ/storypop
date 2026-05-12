import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryPop — a book where your kid is the hero",
  description:
    "Personalized illustrated children's books. Tell us a name, age, and story idea — Pip writes and illustrates the whole book. Instant PDF, softcover, or hardcover.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only wrap in ClerkProvider when a key is configured. This lets the build
  // succeed in environments without Clerk credentials — the admin routes will
  // fail-open at request time in that case (middleware still gates them).
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = <body>{children}</body>;

  if (!clerkPk) {
    return (
      <html lang="en">
        {body}
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">{body}</html>
    </ClerkProvider>
  );
}
