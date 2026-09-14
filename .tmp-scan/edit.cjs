/**
 * Line-ending-safe string replacement.
 *
 * Most files in this repo are CRLF on disk. A replacement written with \n in a
 * script matched nothing and reported success, which is how a helper was added
 * to types.ts that never arrived. Normalise, replace, restore.
 *
 * Usage: node .tmp-scan/edit.cjs <file> <patchModule>
 * where patchModule exports (s) => newS, operating on LF-normalised text.
 */
const fs = require("fs");
const path = require("path");

const [file, patchFile] = process.argv.slice(2);
const raw = fs.readFileSync(file, "utf8");
const wasCrlf = raw.includes("\r\n");
const lf = wasCrlf ? raw.split("\r\n").join("\n") : raw;

const patch = require(path.resolve(patchFile));
const out = patch(lf);
if (out === lf) {
  console.error("NO CHANGE — the anchor did not match: " + file);
  process.exit(1);
}
fs.writeFileSync(file, wasCrlf ? out.split("\n").join("\r\n") : out);
console.log("patched " + file);
