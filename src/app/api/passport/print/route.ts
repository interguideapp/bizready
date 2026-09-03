import { NextResponse } from "next/server";
import { loadPassport } from "@/lib/passport-data";
import { renderPassportHtml } from "@/lib/documents/passport";

export const dynamic = "force-dynamic";

/** The business passport as a print-ready HTML page (browser → Save as PDF). */
export async function GET(request: Request) {
  const data = await loadPassport();
  if (!data) return NextResponse.redirect(new URL("/login", request.url));

  const html = renderPassportHtml(data).replace(
    "</body>",
    `<div class="no-print" style="text-align:center;margin:28px 0">
       <button onclick="window.print()" style="font-size:15px;padding:10px 22px;border:0;border-radius:10px;background:#4f46e5;color:#fff;cursor:pointer">שמירה כ-PDF / הדפסה</button>
     </div>
     <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script>
   </body>`
  );

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
