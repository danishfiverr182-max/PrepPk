/**
 * src/pages/user/NotFoundPage.jsx  (updated — consolidated onto SeoHead)
 *
 * 404 page with proper meta tags so search engines don't index it.
 * Previously used a raw <Helmet> just for title + robots noindex   swapped
 * to <SeoHead noIndex /> (see components/SeoHead.jsx), which now supports
 * a noIndex prop for exactly this case: emits the noindex/nofollow robots
 * tag and skips the canonical link, since a 404 has no real canonical URL.
 */
import { Link } from "react-router-dom";
import SeoHead from "../../components/SeoHead";

export default function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center dark:bg-dark-bg">
      <SeoHead
        title="Page Not Found | PrepPK"
        description="The page you're looking for doesn't exist or has been moved."
        noIndex
      />
      <p className="text-6xl font-black text-gray-200 dark:text-slate-700 mb-4">404</p>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Page Not Found</h1>
      <p className="text-gray-500 dark:text-slate-400 mb-8 text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-block bg-blue-900 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
      >
        Go Home
      </Link>
    </div>
  );
}
