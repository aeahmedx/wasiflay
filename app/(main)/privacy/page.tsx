import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { SUPPORT_EMAIL, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <article className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Privacy
        </h1>
        <p className="mt-1 text-sm text-stone-500">Version {TERMS_VERSION}</p>

        <div className="mt-6 space-y-6 text-stone-800 leading-relaxed">
          <section>
            <h2 className="font-semibold text-stone-900">
              What we collect
            </h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>
                <strong>Your Google account</strong> — email and account
                ID, used to sign you in. We never see your Google
                password.
              </li>
              <li>
                <strong>Your profile</strong> — display name, region,
                optional town, country, and date of birth.
              </li>
              <li>
                <strong>What you post</strong> — questions, answers, chat
                messages, reactions, photos, and events.
              </li>
              <li>
                <strong>Your phone number</strong> — only if you choose to
                turn on text notifications.
              </li>
              <li>
                <strong>Reports you make</strong> — and reports made about
                your content.
              </li>
            </ul>
            <p className="mt-2">
              We don&apos;t use advertising trackers, we don&apos;t sell
              anything to anyone, and we don&apos;t build advertising
              profiles.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Your date of birth
            </h2>
            <p className="mt-1.5">
              Used to check you&apos;re old enough and to apply extra
              protections to accounts under 18. It is never shown to
              anyone. If you&apos;re under 18, your town is never
              displayed publicly, and your contact details are never
              released to event organisers.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Your phone number
            </h2>
            <p className="mt-1.5">
              Stored only if you turn on text notifications. It is not
              shown on your profile, not visible to other members, not
              visible to moderators, and not searchable. It is used for
              one thing: texting you when someone answers your question.
              Turn it off any time from your profile.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Anonymous posts
            </h2>
            <p className="mt-1.5">
              When you post anonymously, your name is not shown and your
              account is not linked to that post anywhere other people can
              reach — including through our own interface. Moderators can
              still identify the author of reported content, because
              otherwise anonymity would make harassment unmoderatable.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Photos</h2>
            <p className="mt-1.5">
              Photos are resized in your browser before uploading, which
              also strips location data your phone may have embedded. They
              are stored on our hosting provider and visible to anyone who
              can see the room they were posted in. Deleting a photo
              deletes the file.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Event RSVPs</h2>
            <p className="mt-1.5">
              If you RSVP to an online event, your name, phone, and email
              are shared with that event&apos;s organiser so they can send
              you joining details — you&apos;ll be told before you
              confirm. If you&apos;re under 18, your contact details are
              never shared; the organiser only sees that someone is
              attending. RSVP details are deleted 30 days after the event
              ends, and cancelling an RSVP deletes them immediately.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Who we share with
            </h2>
            <p className="mt-1.5">
              Only the services needed to run the platform: our hosting
              and database provider, and our text-message provider if you
              turned texts on. We also share information when the law
              requires it, or when someone&apos;s safety is at risk.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Getting your data or deleting it
            </h2>
            <p className="mt-1.5">
              You can delete your account from your profile at any time.
              Your profile and personal details are removed; posts and
              answers may remain with your name detached, so conversations
              other people took part in remain readable.
            </p>
            <p className="mt-1.5">
              To request a copy of your data, or deletion of something
              specific, email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-emerald-800 underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              . We&apos;ll respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Security</h2>
            <p className="mt-1.5">
              Access to your data is restricted at the database level, not
              just in the app — private fields like your date of birth and
              phone number cannot be read by other members even through
              direct access. No system is perfectly secure, and we
              won&apos;t claim otherwise.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              People under 18
            </h2>
            <p className="mt-1.5">
              Accounts for people under 13 are not permitted. If we learn
              an account belongs to someone younger, we delete it. Parents
              or guardians who want an account removed can email us and
              we&apos;ll act on it.
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
            href="/guidelines"
            className="text-emerald-800 underline underline-offset-4"
          >
            Guidelines
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
