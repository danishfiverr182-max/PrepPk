/**
 * src/pages/user/HomePage.jsx — Updated with StatsBar + WhyPremiumSection
 */
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import HeroSection from "../../public/components/HeroSection";
import CategoryCardsSection from "../../public/components/CategoryCardsSection";
import StatsBar from "../../public/components/StatsBar";
import TestimonialsSection from "../../public/components/TestimonialsSection";
import WhyPremiumSection from "../../public/components/WhyPremiumSection";
import SeoHead from "../../components/SeoHead";
import { useSeoMeta } from "../../hooks/useSeoMeta";

export default function HomePage() {
  const { premiumUser } = useAuth();
  const { openPremiumPopup } = useOutletContext();

  const { title, description, jsonLd } = useSeoMeta("home");

  function handleLockedClick(category) {
    const intent = { pathname: `/category/${category.slug}` };
    if (!premiumUser) {
      openPremiumPopup({ mode: "visitor", intent });
    } else {
      openPremiumPopup({ mode: "upgrade", categoryName: category.name, intent });
    }
  }

  return (
    <div>
      <SeoHead title={title} description={description} jsonLd={jsonLd} />

      {/* ── Cinematic Hero ───────────────────────────────── */}
      <HeroSection />

      {/* ── Social Proof Stats Bar ───────────────────────── */}
      <StatsBar />

      {/* ── Category Cards Grid ──────────────────────────── */}
      <CategoryCardsSection premiumUser={premiumUser} onLockedClick={handleLockedClick} />

      {/* ── Student Testimonials ──────────────────────────── */}
      {!premiumUser && <TestimonialsSection />}

      {/* ── Why Go Premium? Section ──────────────────────── */}
      {!premiumUser && (
        <WhyPremiumSection onBuyPremiumClick={() => openPremiumPopup({})} />
      )}
    </div>
  );
}