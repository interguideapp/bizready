/**
 * Outbound notification channels (email, WhatsApp).
 *
 * Both channels are optional and gated on env vars — the app works fully
 * without them (in-app notifications always work). When the credentials are
 * present, the daily cron uses these to push reminders out.
 */

export interface DigestItem {
  title: string;
  body: string | null;
}

export interface OutboundDigest {
  businessName: string;
  items: DigestItem[];
  appUrl: string;
}

// ---------- Email (Resend) ----------

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);
}

export async function sendEmailDigest(
  to: string,
  digest: OutboundDigest
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email not configured" };

  const list = digest.items
    .map(
      (i) =>
        `<li style="margin-bottom:10px"><strong>${escapeHtml(i.title)}</strong>${
          i.body ? `<br><span style="color:#64748b">${escapeHtml(i.body)}</span>` : ""
        }</li>`
    )
    .join("");

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h1 style="color:#4338ca;font-size:20px">BizReady — מה דורש תשומת לב</h1>
      <p style="color:#334155">שלום, לגבי <strong>${escapeHtml(digest.businessName)}</strong> — יש כמה דברים שכדאי לטפל בהם:</p>
      <ul style="padding-inline-start:18px;color:#0f172a">${list}</ul>
      <a href="${digest.appUrl}/dashboard" style="display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:bold">פתיחת BizReady</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">מייל תפעולי מ-BizReady. לניהול התראות — היכנסו להגדרות באפליקציה.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL,
        to,
        subject: `BizReady · ${digest.items.length} דברים דורשים תשומת לב`,
        html,
      }),
    });
    if (!res.ok) return { ok: false, error: `resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}

// ---------- WhatsApp (Meta Cloud API) ----------

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Sends a WhatsApp message via Meta's Cloud API.
 *
 * NOTE: proactive (business-initiated) messages must use a pre-approved
 * message template. Configure WHATSAPP_TEMPLATE_NAME to an approved template
 * with a single body parameter; we pass the digest summary as that parameter.
 */
export async function sendWhatsappDigest(
  toPhone: string,
  digest: OutboundDigest
): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappConfigured()) return { ok: false, error: "whatsapp not configured" };

  const summary = digest.items
    .slice(0, 5)
    .map((i) => `• ${i.title}`)
    .join("\n");
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  const body = templateName
    ? {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "he" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: summary }],
            },
          ],
        },
      }
    : {
        // fallback plain text — only delivered within a 24h customer service window
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: `BizReady — דברים לטיפול:\n${summary}` },
      };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return { ok: false, error: `whatsapp ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "whatsapp failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
