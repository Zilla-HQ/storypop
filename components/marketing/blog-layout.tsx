import Link from "next/link";
import { BLOG_POSTS, type BlogPost, relatedPosts } from "@/lib/blog";
import { Card, CardContent } from "@/components/ui/card";

interface PostShellProps {
  post: BlogPost;
  children: React.ReactNode;
}

/**
 * Shared layout for /blog/[slug] pages — hero, byline, body container,
 * CTA strip, and related-posts row. Article body is the children.
 */
export function PostShell({ post, children }: PostShellProps) {
  const related = relatedPosts(post.slug, 2);
  return (
    <>
      <article className="container max-w-3xl py-12">
        <header className="border-b pb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {categoryLabel(post.category)} · {post.readingMinutes} min read
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
          <div className="mt-4 text-xs text-muted-foreground">
            Published{" "}
            {post.publishedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · By the Restay team
          </div>
        </header>

        <div className="prose prose-slate max-w-none py-10 [&>h2]:mt-10 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:tracking-tight [&>h3]:mt-6 [&>h3]:text-xl [&>h3]:font-semibold [&>p]:mt-4 [&>p]:leading-7 [&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ol]:mt-4 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-6 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold">
          {children}
        </div>
      </article>

      <section className="border-y bg-muted/30 py-12">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Get the work done, not just the diagnosis.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Restay rewrites your listing copy, restyles 10 of your photos, and
            generates a 30-day pricing report — delivered in under 4 hours. One-time
            $79.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/grade"
              className="inline-flex h-11 items-center rounded-md border border-input bg-background px-5 text-sm font-medium hover:bg-accent"
            >
              Grade your listing free
            </Link>
            <Link
              href="/host"
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Get the $79 Tune-Up →
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container py-12">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Related reading</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {related.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="space-y-2 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {categoryLabel(p.category)} · {p.readingMinutes} min
                    </div>
                    <div className="text-lg font-semibold">{p.title}</div>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function BlogIndex() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
  return (
    <>
      <section className="border-b bg-gradient-to-b from-background to-muted/30 py-16">
        <div className="container max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Restay Journal
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Specific, falsifiable advice on Airbnb listing optimization. No fluff,
            no "10 ways to..." listicles — just what works in 2026 and what doesn't.
          </p>
        </div>
      </section>

      <section className="container py-12">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          {sorted.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="block">
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="space-y-2 p-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {categoryLabel(p.category)} · {p.readingMinutes} min
                  </div>
                  <h2 className="text-xl font-semibold">{p.title}</h2>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="pt-2 text-xs text-muted-foreground">
                    {p.publishedAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function categoryLabel(c: BlogPost["category"]): string {
  switch (c) {
    case "ranking":
      return "Ranking";
    case "photos":
      return "Photos";
    case "copy":
      return "Copy";
    case "policy":
      return "Policy";
    case "pricing":
      return "Pricing";
  }
}
