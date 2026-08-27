import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Support" };

const TOPICS = [
  {
    q: "Something is broken",
    a: "Tell us what you were doing and what happened, and include a screenshot if you can. Most things get fixed within a day.",
  },
  {
    q: "Someone is harassing me",
    a: "Report the post, answer, or message using the Report option on it. Reports go to moderators, not to the person you reported. If it's urgent, email us directly.",
  },
  {
    q: "My content was removed and I think that's wrong",
    a: "Email us with a rough description of what it was. Removals are reversible and every one is reviewable.",
  },
  {
    q: "I want my account or my data deleted",
    a: "You can delete your account from your profile. For anything more specific, email us and we'll handle it within 30 days.",
  },
  {
    q: "I'm worried about someone's safety",
    a: "If it looks immediate, contact emergency services in your area first — local help is faster than we are. Then report it here so moderators can act. In the US and Canada, 988 reaches the Suicide & Crisis Lifeline.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Support
        </h1>
        <p className="mt-1.5 text-stone-600">
          A real person reads this address.
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-4 block rounded-lg bg-emerald-800 px-4 py-3 text-center font-medium text-stone-0"
        >
          Email {SUPPORT_EMAIL}
        </a>

        <div className="mt-8 space-y-5">
          {TOPICS.map((t) => (
            <section key={t.q}>
              <h2 className="font-medium text-stone-900">{t.q}</h2>
              <p className="mt-1 text-stone-700 leading-relaxed">{t.a}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex gap-4 border-t border-stone-200 pt-5 text-sm">
          <Link
            href="/terms"
            className="text-emerald-800 underline underline-offset-4"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-emerald-800 underline underline-offset-4"
          >
            Privacy
          </Link>
          <Link
            href="/guidelines"
            className="text-emerald-800 underline underline-offset-4"
          >
            Guidelines
          </Link>
        </div>
      </div>
    </main>
  );
}
