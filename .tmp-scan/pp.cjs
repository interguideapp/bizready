module.exports = (s) => s.replace(
  "  const spec = completionSpecOf({ completion });",
  "  const spec = completion ?? DEFAULT_COMPLETION;"
);
