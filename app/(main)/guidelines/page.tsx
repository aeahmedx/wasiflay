import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function GuidelinesPage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <article className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Community Guidelines
        </h1>

        <div className="mt-6 space-y-6 text-stone-800 leading-relaxed">
          <p>
            Wasif Lay works because people help each other. These rules
            exist to keep it that way. They apply to everyone equally —
            moderators included.
          </p>

          <section>
            <h2 className="font-semibold text-stone-900">
              Coordination, not conflict
            </h2>
            <p className="mt-1.5">
              This is a place to find answers, not to argue about
              politics. Political argument threads get removed. That
              applies whatever side you&apos;re on, and it isn&apos;t a
              judgement about who&apos;s right — it&apos;s that this
              platform stops working for everyone when it becomes a
              battleground.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Don&apos;t attack people
            </h2>
            <p className="mt-1.5">
              No harassment, threats, or insults aimed at a person. No
              attacks based on tribe, region, ethnicity, religion, gender,
              or anything else about who someone is. Disagree with what
              someone said, not with who they are.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Don&apos;t expose people
            </h2>
            <p className="mt-1.5">
              Don&apos;t post someone else&apos;s phone number, address,
              workplace, immigration status, or photos without their
              permission. This matters more here than in most places —
              some people in this community have real reasons to keep
              those things private.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Protect young people
            </h2>
            <p className="mt-1.5">
              People as young as 13 use Wasif Lay. Nothing sexual, ever.
              No adult contacting a minor privately, no asking a minor for
              photos or personal details. Content that sexualises a minor
              is removed, the account is deleted, and it is reported to
              the authorities. There is no warning and no second chance
              for this.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              No scams, no spam
            </h2>
            <p className="mt-1.5">
              Don&apos;t ask strangers for money. Don&apos;t promote
              investment schemes, gambling, drugs, or weapons. Don&apos;t
              post the same thing repeatedly. Recommending a business
              you&apos;ve used is welcome; advertising your own repeatedly
              is not.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Be who you say you are
            </h2>
            <p className="mt-1.5">
              Don&apos;t impersonate anyone, and don&apos;t claim
              credentials you don&apos;t hold. Saying you&apos;re a lawyer
              or a doctor when you aren&apos;t can cause real damage here.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              If someone is in danger
            </h2>
            <p className="mt-1.5">
              If you see someone talking about hurting themselves or
              someone else, report it. If it looks immediate, contact
              emergency services in your area first — the fastest help is
              local, not us. In the US and Canada you can call or text{" "}
              <strong>988</strong> for the Suicide &amp; Crisis Lifeline.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              What happens when a rule is broken
            </h2>
            <p className="mt-1.5">
              Usually the content is removed and that&apos;s the end of
              it. Repeated or serious breaches suspend the account —
              suspended accounts can still read but can&apos;t post.
              Anything involving a minor, a credible threat, or a scam
              targeting the community skips straight to removal and
              suspension.
            </p>
            <p className="mt-1.5">
              If you think a decision was wrong, email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-emerald-800 underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              and it will be looked at again.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Anonymous posting
            </h2>
            <p className="mt-1.5">
              Posting anonymously exists so people can ask about
              immigration, money, health, or family without their name
              attached. Using it to harass people instead is treated more
              seriously than doing it under your own name, not less.
            </p>
          </section>
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
            href="/support"
            className="text-emerald-800 underline underline-offset-4"
          >
            Support
          </Link>
        </div>
      </article>
    </main>
  );
}
