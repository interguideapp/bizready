module.exports = (s) =>
  s.replace(
    `/**
 * Yearly-updated legal figures, kept in one place.`,
    `/**
 * THE evidence spec for a template — the one place the fallback is applied.
 *
 * The task page, the completion flow and the certificate all have to agree
 * about which fields a task asks for: the flow collects them, the page shows
 * them, and the certificate labels the stored answers with them. Three
 * separate \`completion ?? DEFAULT_COMPLETION\` expressions did agree — and the
 * certificate, written last, had none, so a free-text note came out of the
 * database labelled \`note\` on a page that calls itself a certificate.
 *
 * One resolution, one home. \`completion-spec.test.ts\` fails the build if a
 * fourth site spells the fallback out again.
 */
export function completionSpecOf(
  template: { completion?: CompletionSpec } | null | undefined
): CompletionSpec {
  return template?.completion ?? DEFAULT_COMPLETION;
}

/**
 * Yearly-updated legal figures, kept in one place.`
  );
