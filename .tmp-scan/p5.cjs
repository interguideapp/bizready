module.exports = (s) => {
  s = s.replace(
    "      return !t.completion?.fields?.some((f) => f.key === \"renewal\");",
    "      return !completionSpecOf(t).fields?.some((f) => f.key === \"renewal\");"
  );
  return s;
};
