import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Wordmark } from "@/components/wordmark";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Welcome",
  description:
    "A place for the Sudanese community to ask, answer, and find each other.",
};

/**
 * What this is, in the person's own time.
 *
 * Reached from the gate, and it outlives the gate — this is the answer
 * to "what is this" that any community app should have, and building it
 * as furniture for a countdown would waste it.
 */
export default function WelcomePage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <article className="mx-auto max-w-md">
        <BackLink />

        <div className="mt-6 flex justify-center">
          <Wordmark size="md" />
        </div>

        <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight text-stone-900">
          A step in the right direction
        </h1>

        <div className="mt-6 space-y-5 leading-relaxed text-stone-800">
          <p>
            Every one of us has asked a question in a group chat and
            watched it scroll away. Which lawyer actually knows
            immigration. Who fixes cars without robbing you. Where to send
            a package home. Whether the school is any good.
          </p>

          <p>
            Somebody in this community knows the answer to every one of
            those. They just never happen to be in the chat at the moment
            you ask, and the answer disappears the moment they are.
          </p>

          <p className="font-medium text-stone-900">
            Wasif Lay is where those answers stay.
          </p>

          <p>
            You ask, someone who actually knows answers, and it stays put
            for the next person. Ask anonymously if the question is about
            money, papers, or family — that&apos;s the whole reason
            anonymity is there.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4">
          <h2 className="font-semibold text-stone-900">
            Why we&apos;re starting at a tournament
          </h2>
          <p className="mt-2 leading-relaxed text-stone-800">
            Because a community app with nobody in it is a phone book with
            no numbers. A weekend where everyone is already together,
            already talking, already arguing about football — that&apos;s
            the moment worth starting from.
          </p>
          <p className="mt-2 leading-relaxed text-stone-800">
            So: call the scores, take the leaderboard seriously, talk
            through every match in its own room. Nobody has ever won this,
            which means whoever tops the board is the first name on it.
          </p>
          <p className="mt-2 leading-relaxed text-stone-800">
            And when the tournament ends, the app is still here — with the
            same people in it, and their questions getting answered.
          </p>
        </div>

        <div className="mt-8 space-y-5 leading-relaxed text-stone-800">
          <h2 className="font-semibold text-stone-900">Who&apos;s behind it</h2>
          <p>
            One person, building it for the community he&apos;s from. No
            company, no investors, nobody being sold anything.
          </p>

          <h2 className="font-semibold text-stone-900">What it isn&apos;t</h2>
          <p>
            Not another group chat you mute. Not a place to argue about
            politics — that gets removed, whoever is right. Not somewhere
            anyone is verified, so check credentials yourself before you
            trust or hire someone.
          </p>

          <p>
            Anything unclear or unfair, email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-emerald-800 underline underline-offset-4"
            >
              {SUPPORT_EMAIL}
            </a>
            . A real person reads it.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 border-t border-stone-200 pt-5 text-sm">
          <Link
            href="/rules"
            className="text-emerald-800 underline underline-offset-4"
          >
            How predictions work
          </Link>
          <Link
            href="/guidelines"
            className="text-emerald-800 underline underline-offset-4"
          >
            Community guidelines
          </Link>
          <Link
            href="/privacy"
            className="text-emerald-800 underline underline-offset-4"
          >
            Privacy
          </Link>
        </div>
      </article>
    </main>
  );
}
