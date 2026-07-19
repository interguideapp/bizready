/** Minimal renderer for task steps: numbered lines with **bold** support. */
export function StepsContent({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <ol className="steps-content text-ink-soft">
      {lines.map((line, i) => (
        <li key={i}>{renderBold(line.replace(/^\d+\.\s*/, ""))}</li>
      ))}
    </ol>
  );
}

function renderBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}
