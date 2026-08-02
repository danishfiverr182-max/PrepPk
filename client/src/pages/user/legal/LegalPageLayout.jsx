/**
 * src/pages/user/legal/LegalPageLayout.jsx
 *
 * Shared wrapper for the static info/legal pages (Privacy Policy, Terms &
 * Conditions, Disclaimer, About Us, Contact Us). Keeps every page's
 * container width, heading style, spacing, and dark-mode handling
 * consistent by construction instead of copy-pasted per page.
 *
 * Uses the @tailwindcss/typography `prose` plugin (already installed —
 * see tailwind.config.js) so H1/H2/H3/paragraphs/lists inside `children`
 * get sensible, readable, mobile-friendly styling automatically. We still
 * override a few prose color tokens with the site's theme-aware
 * `txt-primary` / `txt-secondary` tokens so these pages match the rest of
 * PrepPK in both light and dark mode.
 */
import SeoHead from "../../../components/SeoHead";

export default function LegalPageLayout({
  title,
  description,
  path,
  lastUpdated,
  children,
}) {
  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || "https://www.prepkp.com";

  return (
    <div className="dark:bg-dark-bg">
      <SeoHead
        title={`${title} | PrepPK`}
        description={description}
        url={`${BASE_URL}${path}`}
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <header className="mb-8 border-b border-slate-200 dark:border-white/10 pb-6">
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            {title}
          </h1>
          {lastUpdated && (
            <p className="mt-3 text-sm text-txt-muted">
              Last updated: {lastUpdated}
            </p>
          )}
        </header>

        <article
          className="
            prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-heading prose-headings:font-bold
            prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3
            prose-h3:text-base md:prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-txt-secondary prose-li:text-txt-secondary
            prose-strong:text-txt-primary
            prose-a:text-brand hover:prose-a:text-brand-dark
          "
        >
          {children}
        </article>
      </div>
    </div>
  );
}
