/**
 * src/public/components/TestimonialsSection.jsx — NEW
 *
 * Sample student testimonials shown on the homepage for logged-out /
 * non-premium visitors, reinforcing social proof before the "Why Go
 * Premium?" pitch.
 *
 * NOTE: TESTIMONIALS below are placeholder copy, not real submissions.
 * Swap the array for genuine student reviews as soon as you have some —
 * presenting invented quotes as real customer feedback can be misleading
 * to visitors and, in some jurisdictions (e.g. under FTC rules in the
 * US), is restricted.
 *
 * Avatars are illustrated (DiceBear "notionists" style, generated from a
 * seed string) rather than photos of real people — deliberately, so the
 * cards read as friendly placeholder art rather than implying these are
 * photographed real customers. Each entry is { name, role, quote, rating,
 * avatarSeed }, so replacing them later is a one-line data change.
 */
import { PiStarFill, PiQuotesFill } from "react-icons/pi";
import ratingIcon from "../../assets/rating.png";


const TESTIMONIALS = [
  {
    name: "Ayesha K.",
    role: "Exam Aspirant",
    quote:
      "This site made my exam prep so much easier. The mock tests really helped me feel ready on the actual day.",
    rating: 5,
    avatarSeed: "Ayesha-K",
  },
  {
    name: "Hamza R.",
    role: "Exam Aspirant",
    quote:
      "Great platform overall — clean, easy to use, and packed with practice questions. Highly recommend it.",
    rating: 5,
    avatarSeed: "Hamza-R",
  },
  {
    name: "Sana M.",
    role: "Exam Aspirant",
    quote:
      "I've tried a few test prep sites and this one is by far the most helpful. The mock tests feel just like the real thing.",
    rating: 5,
    avatarSeed: "Sana-M",
  },
  {
    name: "Bilal A.",
    role: "Exam Aspirant",
    quote:
      "Really happy I found this website. It helped me prepare properly instead of guessing what to study.",
    rating: 5,
    avatarSeed: "Bilal-A",
  },
];

function StarRow({ rating }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <PiStarFill
          key={n}
          className="text-sm"
          style={{ color: n <= rating ? "#F5C542" : "rgba(148,163,184,0.35)" }}
        />
      ))}
    </div>
  );
}

function TestimonialCard({ name, role, quote, rating, avatarSeed }) {
  const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
    avatarSeed,
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <div className="relative p-6 rounded-2xl bg-white/60 border border-slate-300 dark:bg-white/5 dark:border-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-1">
      <PiQuotesFill className="absolute top-5 right-5 text-2xl text-slate-300 dark:text-white/10" />

      <StarRow rating={rating} />

      <p className="text-slate-700 dark:text-purple-200/80 text-sm leading-relaxed mt-3 mb-5">
        “{quote}”
      </p>

      <div className="flex items-center gap-3">
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-10 h-10 rounded-full flex-shrink-0 bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10"
        />
        <div>
          <p className="font-heading font-bold text-slate-900 dark:text-white text-sm leading-tight">
            {name}
          </p>
          <p className="text-slate-500 dark:text-purple-300/60 text-xs">
            {role}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section
      className="relative py-16 px-4"
      style={{ background: "var(--bg-why-premium)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(108, 99, 255, 0.1)",
              border: "1px solid rgba(108, 99, 255, 0.3)",
              color: "#6C63FF",
            }}
          >
            <img
              src={ratingIcon}
              alt="Student Feedback"
              className="w-4 h-4 object-contain"
            />
            Student Feedback
          </span>
          <h2 className="font-heading font-black text-3xl md:text-4xl text-slate-900 dark:text-white mb-4">
            What Students <span className="gradient-text">Are Saying</span>
          </h2>
          <p className="text-slate-600 dark:text-purple-300/70 text-base max-w-xl mx-auto">
            A few notes from students preparing with our mock tests.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>
      </div>
    </section>
  );
}
