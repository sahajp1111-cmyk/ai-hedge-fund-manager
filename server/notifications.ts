import crypto from "node:crypto";
import type { Store } from "./store.js";
import type { ScanResult } from "../shared/schema.js";
export function fingerprint(r: ScanResult) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        r.status,
        r.review?.reviewedAt,
        r.review?.conservativeValue,
        r.review?.thesisInvalidation,
      ]),
    )
    .digest("hex");
}
export async function queueAlert(store: Store, r: ScanResult) {
  await store.mutate((s) => {
    const previous = s.alerts.filter((a) => a.key === r.id).at(-1);
    const hash = fingerprint(r);
    // Only first qualification, changed reviewed thesis, or loss/re-entry of qualification.
    if (r.status !== "QUALIFIED" && previous?.result.status !== "QUALIFIED")
      return;
    if (previous?.fingerprint === hash) return;
    for (const alert of s.alerts)
      if (
        alert.key === r.id &&
        (alert.status === "pending" || alert.status === "failed")
      )
        alert.status = "superseded";
    s.alerts.push({
      id: crypto.randomUUID(),
      key: r.id,
      fingerprint: hash,
      createdAt: r.at,
      result: r,
      status: "pending",
      attempts: 0,
    });
  });
}
export async function deliverAlerts(
  store: Store,
  webhook?: string,
  secret?: string,
  fetcher: typeof fetch = fetch,
  telegram?: { token: string; chatId: string },
) {
  if (!webhook && !telegram) return;
  const url = new URL(
    webhook ?? `https://api.telegram.org/bot${telegram!.token}/sendMessage`,
  );
  if (url.protocol !== "https:")
    throw new Error("Notification webhook must use HTTPS");
  for (const alert of store
    .read()
    .alerts.filter(
      (a) =>
        (a.status === "pending" || a.status === "failed") &&
        a.attempts < 8 &&
        (!a.nextAttemptAt || Date.parse(a.nextAttemptAt) <= Date.now()),
    )) {
    const body = JSON.stringify({
      event:
        alert.result.status === "QUALIFIED"
          ? "research_candidate"
          : "thesis_review",
      alertId: alert.id,
      result: alert.result,
    });
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Idempotency-Key": alert.id,
      };
      if (secret)
        headers["X-SignalDesk-Signature"] = crypto
          .createHmac("sha256", secret)
          .update(body)
          .digest("hex");
      const payload = webhook
        ? body
        : JSON.stringify({
            chat_id: telegram!.chatId,
            text: [
              `SignalDesk research: ${alert.key}`,
              alert.result.status,
              "Research only — not an order",
              `Close: ${alert.result.price ?? "unavailable"} ${alert.result.identity.currency} (${alert.result.priceDate ?? "unknown date"})`,
              ...alert.result.reasons,
              alert.result.review
                ? `Scenario values: ${alert.result.review.bearValue} / ${alert.result.review.conservativeValue} / ${alert.result.review.bullValue}`
                : "",
              alert.result.review?.thesisInvalidation ?? "",
              alert.result.source ?? "",
              `Alert ID: ${alert.id}`,
            ]
              .join("\n")
              .slice(0, 4000),
          });
      const response = await fetcher(url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`Delivery HTTP ${response.status}`);
      if (!webhook && ((await response.json()) as { ok?: boolean }).ok !== true)
        throw new Error("Telegram rejected delivery");
      await store.mutate((s) => {
        const a = s.alerts.find((a) => a.id === alert.id)!;
        a.status = "sent";
        a.attempts++;
        a.lastError = undefined;
      });
    } catch {
      await store.mutate((s) => {
        const a = s.alerts.find((a) => a.id === alert.id)!;
        a.status = "failed";
        a.attempts++;
        a.lastError =
          "Notification delivery failed; check destination availability";
        a.nextAttemptAt = new Date(
          Date.now() + Math.min(3600000, 30000 * 2 ** a.attempts),
        ).toISOString();
      });
    }
  }
}
