import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogSection } from "@/components/blog-section";
import { ShareButtons } from "@/components/share-buttons";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-catalog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Post — Sitebeat" };
  const ogImage = `/api/og?title=${encodeURIComponent(post.title)}&kicker=${encodeURIComponent("Sitebeat Blog")}`;
  return {
    title: `${post.title} — Sitebeat`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.datePublished,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <article className="container max-w-3xl py-12">
      <Link
        href="/blog"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← All posts
      </Link>

      <header className="mt-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <time>
            {new Date(post.datePublished).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-5 text-xl leading-relaxed text-muted-foreground">
          {post.lede}
        </p>
      </header>

      <div className="prose-stack mt-12 space-y-5">
        {post.body.map((s, i) => (
          <BlogSection key={i} section={s} />
        ))}
      </div>

      <div className="mt-12 border-t pt-6">
        <ShareButtons title={post.title} />
      </div>

      {others.length > 0 && (
        <section className="mt-20 border-t pt-10">
          <h2 className="text-xl font-bold tracking-tight">More from the blog</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-lg border bg-card p-4 hover:bg-muted/30"
              >
                <h3 className="text-sm font-semibold leading-snug">{p.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.readingMinutes} min read
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.datePublished,
            author: { "@type": "Organization", name: "Sitebeat" },
            publisher: {
              "@type": "Organization",
              name: "Sitebeat",
              url: "https://sitebeat.tech",
            },
            mainEntityOfPage: `https://sitebeat.tech/blog/${post.slug}`,
          }),
        }}
      />
    </article>
  );
}
