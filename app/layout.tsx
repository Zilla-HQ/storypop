import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://storypop-hq.vercel.app"),
  title: "Storypop — A storybook starring your kid",
  description:
    "Personalized AI-illustrated children's books. Upload one photo, type a name, get a 12-page magical story in 2 minutes. $9.",
  openGraph: {
    title: "Storypop — A storybook starring your kid",
    description:
      "Personalized AI-illustrated children's books. From one photo. In 2 minutes.",
    type: "website",
    url: "/",
    siteName: "Storypop",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "A child as the hero of their own storybook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Storypop — A storybook starring your kid",
    description:
      "Personalized AI-illustrated children's books. From one photo. In 2 minutes.",
    images: ["/og.jpg"],
  },
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
