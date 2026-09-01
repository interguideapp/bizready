import { NextResponse } from "next/server";
import { GENERATORS_BY_ID, renderDocHtml } from "@/lib/documents/generators";
import { getBusiness } from "@/lib/data";
import { isPro } from "@/lib/subscription";
import type { OnboardingAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Returns a generated legal document as a self-contained, print-ready HTML page
 * (the browser prints it to PDF). Pro-gated — document generation is a paid
 * feature. Free users are redirected back to the task's paywalled preview.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const generator = GENERATORS_BY_ID.get(type);
  if (!generator) {
    return NextResponse.json({ error: "unknown document" }, { status: 404 });
  }

  const business = await getBusiness();
  if (!business) return NextResponse.redirect(new URL("/login", _request.url));
  if (!isPro(business)) {
    return NextResponse.redirect(
      new URL(`/tasks/${generator.templateId}`, _request.url)
    );
  }

  const answers = business.onboarding_answers as OnboardingAnswers;
  const doc = generator.build({
    businessName: business.name,
    entityType: business.entity_type,
    dealerNumber: business.dealer_number,
    field: business.field,
    answers,
    today: new Date(),
  });

  const html = renderDocHtml(doc, business.name).replace(
    "</body>",
    `<div class="no-print" style="text-align:center;margin:28px 0">
       <button onclick="window.print()" style="font-size:15px;padding:10px 22px;border:0;border-radius:10px;background:#4f46e5;color:#fff;cursor:pointer">שמירה כ-PDF / הדפסה</button>
     </div>
     <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script>
   </body>`
  );

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
