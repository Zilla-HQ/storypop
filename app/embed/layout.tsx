import "../globals.css";

/**
 * Minimal layout for iframe-embedded pages. No header, no footer, no
 * marketing chrome — partners drop these into their own pages.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
