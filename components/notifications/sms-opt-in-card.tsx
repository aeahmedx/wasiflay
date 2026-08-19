"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  confirmPhoneEnrollment,
  setSmsOptIn,
  startPhoneEnrollment,
  toE164,
} from "@/lib/queries/notifications";

type Step = "offer" | "phone" | "code" | "done" | "dismissed";

/**
 * Offered after someone posts a question — the moment they actually want
 * to know when it's answered. Asking for a phone number at signup adds
 * friction exactly where it costs the most.
 *
 * The number goes to Supabase Auth, not to a column we control, so
 * nothing in the app can read it back.
 */
export function SmsOptInCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("offer");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = toE164(phone);

  async function sendCode() {
    if (!normalised || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startPhoneEnrollment(createClient(), normalised);
      setStep("code");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.toLowerCase().includes("sms") || msg.toLowerCase().includes("provider")
          ? "Text messages aren't switched on yet. Try again in a day or two."
          : "Couldn't send the code. Check the number and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!normalised || code.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await confirmPhoneEnrollment(supabase, normalised, code.trim());
      await setSmsOptIn(supabase, userId, true);
      setStep("done");
      router.refresh();
    } catch {
      setError("That code didn't work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "dismissed") return null;

  if (step === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-900">
          Done. We&apos;ll text you when someone answers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
      {step === "offer" && (
        <>
          <p className="font-medium text-stone-900">
            Want a text when someone answers?
          </p>
          <p className="mt-1 text-sm text-stone-600">
            One message per answer. Nobody sees your number, and you can
            turn it off anytime.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setStep("phone")}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0"
            >
              Yes, text me
            </button>
            <button
              onClick={() => setStep("dismissed")}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700"
            >
              No thanks
            </button>
          </div>
        </>
      )}

      {step === "phone" && (
        <>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-stone-800 mb-1.5"
          >
            Your number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(215) 555-0123"
            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          />
          {phone.length > 4 && !normalised && (
            <p className="mt-1.5 text-sm text-stone-600">
              That doesn&apos;t look like a full number. Include the area
              code, or start with + for outside the US.
            </p>
          )}
          {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={sendCode}
              disabled={!normalised || busy}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
            <button
              onClick={() => setStep("dismissed")}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {step === "code" && (
        <>
          <p className="text-sm text-stone-700">
            We sent a code to {normalised}.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            aria-label="Verification code"
            className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          />
          {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={verify}
              disabled={code.trim().length < 4 || busy}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button
              onClick={() => setStep("phone")}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700"
            >
              Change number
            </button>
          </div>
        </>
      )}
    </div>
  );
}
