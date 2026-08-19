import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends "someone answered your question" texts.
 *
 * Called on a schedule (Vercel Cron) rather than inline, so a Twilio
 * outage can never block someone from posting an answer.
 *
 * No-ops cleanly when Twilio isn't configured, which is the state until
 * the account is funded — the rest of the app doesn't care.
 */
export const dynamic = "force-dynamic";

const BATCH = 50;

export async function GET(request: NextRequest) {
  // Vercel Cron sends this header; nothing else should reach the route.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wasiflay.com";

  if (!sid || !token || !from) {
    return NextResponse.json({ skipped: "twilio not configured" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin.rpc("pending_sms", { p_limit: BATCH });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = (data ?? []) as {
    notification_id: string;
    phone: string;
    post_id: string | null;
    post_title: string | null;
  }[];

  if (pending.length === 0) return NextResponse.json({ sent: 0 });

  const sent: string[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    const title = (item.post_title ?? "your question").slice(0, 60);
    const link = item.post_id ? `${site}/posts/${item.post_id}` : site;
    const body = `Wasif Lay: someone answered "${title}". ${link}`;

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString(
              "base64"
            )}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: item.phone, From: from, Body: body }),
        }
      );

      // Mark as sent either way on a 4xx: a bad number will fail forever,
      // and retrying it every minute burns credit for nothing.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        sent.push(item.notification_id);
      } else {
        failed.push(item.notification_id);
      }
    } catch {
      failed.push(item.notification_id);
    }
  }

  if (sent.length > 0) {
    await admin.rpc("mark_sms_sent", { p_ids: sent });
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length });
}
