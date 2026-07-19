import { BookOpen } from "lucide-react";

/**
 * Minimal markdown renderer for long-form task guides:
 * ## headings, numbered/bulleted lists, paragraphs, **bold**.
 */
export function GuideContent({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <details className="group rounded-2xl border border-edge bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 font-bold text-ink [&::-webkit-details-marker]:hidden">
        <BookOpen className="h-4.5 w-4.5 text-brand-500" aria-hidden />
        מדריך מורחב
        <span className="mr-auto text-xs font-normal text-ink-muted group-open:hidden">
          לחצו לפתיחה
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-edge-soft px-5 py-4 text-sm leading-relaxed text-ink-soft">
        {blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </details>
  );
}

function renderBlock(block: string, key: number) {
  if (block.startsWith("### ")) {
    return (
      <h4 key={key} className="mt-1 font-semibold text-ink">
        {inline(block.slice(4))}
      </h4>
    );
  }
  if (block.startsWith("## ")) {
    return (
      <h3 key={key} className="mt-2 text-base font-bold text-ink">
        {inline(block.slice(3))}
      </h3>
    );
  }
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.every((l) => /^(\d+\.|-|\*)\s/.test(l))) {
    const ordered = /^\d+\./.test(lines[0]);
    const items = lines.map((l, i) => (
      <li key={i}>{inline(l.replace(/^(\d+\.|-|\*)\s*/, ""))}</li>
    ));
    return ordered ? (
      <ol key={key} className="list-decimal space-y-1.5 pr-5">
        {items}
      </ol>
    ) : (
      <ul key={key} className="list-disc space-y-1.5 pr-5">
        {items}
      </ul>
    );
  }
  return <p key={key}>{inline(block)}</p>;
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}
