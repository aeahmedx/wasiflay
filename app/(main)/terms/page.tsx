import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { SUPPORT_EMAIL, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <article className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Terms of Use
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Version {TERMS_VERSION}
        </p>

        <div className="mt-6 space-y-6 text-stone-800 leading-relaxed">
          <section>
            <h2 className="font-semibold text-stone-900">What this is</h2>
            <p className="mt-1.5">
              Wasif Lay is a community platform where people ask questions,
              answer each other, share what they know, and talk in live
              rooms. Using it means agreeing to what&apos;s written here.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Who can use it</h2>
            <p className="mt-1.5">
              You must be at least 13 years old. If you are under 18, a
              parent or guardian must review these terms and agree to you
              using Wasif Lay. By continuing, you confirm that has
              happened.
            </p>
            <p className="mt-1.5">
              One account per person. Don&apos;t pretend to be someone
              else, and don&apos;t create an account for someone else.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              What you post is yours
            </h2>
            <p className="mt-1.5">
              You keep ownership of everything you write and every photo
              you upload. By posting, you give Wasif Lay permission to
              store and display it so the platform works. You can delete
              your own posts, answers, and messages at any time.
            </p>
            <p className="mt-1.5">
              Only post things you have the right to post. Don&apos;t
              upload someone else&apos;s photos, writing, or private
              information without their permission.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">What isn&apos;t allowed</h2>
            <p className="mt-1.5">
              The{" "}
              <Link
                href="/guidelines"
                className="text-emerald-800 underline underline-offset-4"
              >
                Community Guidelines
              </Link>{" "}
              are part of these terms. Breaking them can get content
              removed or your account suspended.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              We don&apos;t vouch for anyone
            </h2>
            <p className="mt-1.5">
              People recommend doctors, lawyers, contractors, tutors and
              others here. Wasif Lay does not verify anyone&apos;s
              credentials, licences, or quality of work, and does not
              check whether advice is correct. Nothing here is
              professional, legal, medical, or financial advice. Use your
              own judgement, and check credentials yourself before hiring
              or trusting someone.
            </p>
            <p className="mt-1.5">
              Events are created by community members, not by Wasif Lay.
              We don&apos;t run them, verify them, or take responsibility
              for what happens at them.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Moderation and suspension
            </h2>
            <p className="mt-1.5">
              Moderators can remove content and suspend accounts. Removal
              is reversible and reviewable; a suspended account can still
              read but cannot post. Serious cases can be deleted
              permanently. We can suspend or remove an account at any
              time, including for behaviour outside the platform that puts
              community members at risk.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              Ending your account
            </h2>
            <p className="mt-1.5">
              You can delete your account at any time from your profile.
              Posts and answers you wrote may remain visible with your
              name removed, so conversations other people took part in
              stay readable. Email us if you want something specific
              removed.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">
              No guarantees, limited liability
            </h2>
            <p className="mt-1.5">
              Wasif Lay is provided as-is, with no promise that it will
              always work, always be available, or always be accurate. To
              the extent the law allows, we aren&apos;t liable for losses
              arising from using it — including anything that comes of
              acting on advice, hiring someone, attending an event, or
              meeting someone through the platform.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Changes</h2>
            <p className="mt-1.5">
              If these terms change in a meaningful way, you&apos;ll be
              asked to read and accept them again before continuing.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900">Contact</h2>
            <p className="mt-1.5">
              Questions, complaints, or legal notices:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-emerald-800 underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 flex gap-4 border-t border-stone-200 pt-5 text-sm">
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
