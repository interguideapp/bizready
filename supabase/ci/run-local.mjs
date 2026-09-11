/**
 * Run the CI migration check locally, with no Postgres, Docker or Supabase CLI
 * installed — PGlite is real Postgres compiled to WASM.
 *
 * This exists because for a long time the GitHub job was the ONLY place the
 * migration set ever ran, so nobody saw its result until after a push. The
 * first local run immediately found two defects that had been failing the real
 * job: the stub's auth.users was missing raw_user_meta_data, which 001_init's
 * signup trigger reads, so every "insert into auth.users" in the assertions
 * died; and the assertions then inserted profiles rows that the same trigger
 * had already created, colliding on the primary key.
 *
 *   npm run verify:migrations:local
 *
 * Caveat worth knowing: PGlite does not bundle pgcrypto, so that one statement
 * is skipped here. Nothing in the set depends on it — gen_random_uuid(),
 * sha256(), encode() and convert_to() are all core Postgres — and the real
 * job has the extension.
 *
 * It INTERPRETS the real script rather than reimplementing it, so the thing
 * being verified is the file CI actually runs. Three command forms appear in
 * that script and nothing else matters:
 *
 *   psql_run <path>                     -> execute that file
 *   for f in $(ls supabase/migrations/*.sql | sort); do ... done
 *                                       -> execute every migration, sorted
 *   psql "$DB_URL" ... <<'SQL' ... SQL  -> execute the heredoc body
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SCRIPT = "supabase/ci/verify-migrations.sh";

function plan() {
  const lines = fs.readFileSync(SCRIPT, "utf8").split(/\r?\n/);
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const run = line.match(/^\s*psql_run\s+(\S+)\s*$/);
    // The loop body's own `psql_run "$f"` is already covered by the
    // all-migrations step, so skip the variable form.
    if (run && !run[1].includes("$f")) {
      steps.push({ kind: "file", path: run[1] });
      continue;
    }

    if (/^\s*for f in .*supabase\/migrations\/\*\.sql/.test(line)) {
      steps.push({ kind: "all-migrations" });
      continue;
    }

    // psql ... <<'SQL'  (the quoted heredoc the script uses throughout)
    if (/^\s*psql\s+"\$DB_URL".*<<'SQL'\s*$/.test(line)) {
      const body = [];
      let j = i + 1;
      for (; j < lines.length && lines[j].trim() !== "SQL"; j++) body.push(lines[j]);
      if (j >= lines.length) throw new Error(`unterminated heredoc at line ${i + 1}`);
      steps.push({ kind: "sql", body: body.join("\n"), line: i + 1 });
      i = j;
      continue;
    }
  }
  return steps;
}

const db = new PGlite();
await db.waitReady;

// pgcrypto is not bundled with PGlite. Nothing in the set needs it: gen_random_uuid()
// and sha256()/encode()/convert_to() are all core since PG13/PG11. Swallow only
// that one statement, and say so, rather than silently editing the stub.
let pgcryptoSkipped = false;

async function exec(sql, label) {
  try {
    await db.exec(sql);
  } catch (err) {
    if (/pgcrypto/.test(String(err?.message)) || /extension "pgcrypto"/.test(String(err))) {
      pgcryptoSkipped = true;
      const without = sql.replace(/create extension if not exists pgcrypto\s*;/gi, "");
      await db.exec(without);
      return;
    }
    throw new Error(`${label}\n  ${String(err?.message ?? err).split("\n").join("\n  ")}`);
  }
}

const steps = plan();
console.log(`parsed ${steps.length} steps from ${SCRIPT}\n`);

let migrationsApplied = 0;
let sqlBlocks = 0;

for (const step of steps) {
  if (step.kind === "file") {
    console.log(`→ ${step.path}`);
    await exec(fs.readFileSync(step.path, "utf8"), `FAILED applying ${step.path}`);
  } else if (step.kind === "all-migrations") {
    const dir = "supabase/migrations";
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      console.log(`→ ${name}`);
      await exec(
        fs.readFileSync(path.join(dir, name), "utf8"),
        `FAILED applying migration ${name}`
      );
      migrationsApplied++;
    }
  } else {
    console.log(`→ assertions (script line ${step.line})`);
    await exec(step.body, `FAILED assertion block at ${SCRIPT}:${step.line}`);
    sqlBlocks++;
  }
}

console.log(
  `\nOK — ${migrationsApplied} migrations applied to a clean database, ` +
    `${sqlBlocks} assertion blocks passed.`
);
if (pgcryptoSkipped) {
  console.log(
    "NOTE: 'create extension pgcrypto' was skipped (not bundled with PGlite). " +
      "Everything the set uses from it is core Postgres, and the real CI job has it."
  );
}
await db.close();
