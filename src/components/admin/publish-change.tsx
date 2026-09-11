"use client";

import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { publishContentChange } from "@/lib/actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/form";
import { Button } from "@/components/primitives";
import { Card } from "@/components/ui";
import { CHANGE_LABEL, type ChangeKind } from "@/lib/content/changelog";

/**
 * Writing the "a rule that affects you changed" notice.
 *
 * This is deliberately a form a human fills in, not a button that publishes
 * what the watcher found. The watcher can say a page moved; only a person
 * reading it can say whether a deadline moved, an amount changed, or nothing
 * of substance happened. Publishing the first as the second would be telling
 * users the law changed on the strength of a checksum.
 *
 * Submitting also acknowledges the source, so the moved-sources list and the
 * user-facing notice cannot drift apart.
 */
export function PublishChange({ templateIds }: { templateIds: string[] }) {
  const [templateId, setTemplateId] = useState("");
  const [summary, setSummary] = useState("");
  const [changeKind, setChangeKind] = useState<ChangeKind>("guidance");
  const [sourceUrl, setSourceUrl] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function publish() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await publishContentChange({
        templateId,
        summary,
        changeKind,
        sourceUrl,
        effectiveFrom: effectiveFrom || null,
      });
      if (!result.ok) {
        setError(result.error ?? "הפרסום נכשל.");
        return;
      }
      setDone(true);
      setSummary("");
      setEffectiveFrom("");
    });
  }

  return (
    <Card className="mb-8 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
        <Megaphone className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        פרסום עדכון רגולציה למשתמשים
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-muted">
        מגיע רק למשתמשים שהמשימה הזאת נמצאת בתכנית שלהם. נכתב ביד אחרי קריאת
        המקור — בדיקת המקורות אומרת שדף השתנה, לא מה השתנה בו.
      </p>

      {error && (
        <div className="mb-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      {done && (
        <div className="mb-3">
          <FormMessage tone="success">
            העדכון פורסם והמקור סומן כנבדק.
          </FormMessage>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="משימה">
            <Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={[
                { value: "", label: "בחרו משימה" },
                ...templateIds.map((id) => ({ value: id, label: id })),
              ]}
            />
          </Field>
          <Field label="סוג השינוי" description="מועד שהשתנה מוצג בבירור מהבהרה">
            <Select
              value={changeKind}
              onChange={(e) => setChangeKind(e.target.value as ChangeKind)}
              options={(
                ["deadline", "amount", "rule", "guidance"] as ChangeKind[]
              ).map((k) => ({ value: k, label: CHANGE_LABEL[k] }))}
            />
          </Field>
        </div>

        <Field
          label="מה השתנה"
          description="משפט אחד, בשפה של בעל עסק — זה מה שהוא יקרא"
        >
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="מועד הדיווח לתקופה הנוכחית נדחה ל-20 בחודש"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="קישור למקור הרשמי">
            <Input
              value={sourceUrl}
              dir="ltr"
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.gov.il/..."
              className="text-start"
            />
          </Field>
          <Field label="בתוקף מ- (לא חובה)">
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <Button
            onClick={publish}
            loading={pending}
            disabled={!templateId || !summary.trim() || !sourceUrl.trim()}
            icon={<Megaphone className="h-4 w-4" aria-hidden />}
          >
            פרסום
          </Button>
        </div>
      </div>
    </Card>
  );
}
