"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { setBusinessLogo } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

/** Upload the business logo to storage and pin it on the profile. */
export function LogoUploader({
  currentLogoUrl,
}: {
  currentLogoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("יש להעלות קובץ תמונה (PNG / JPG / SVG)");
      setState("error");
      return;
    }
    setState("uploading");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("לא מחוברים");

      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/logo-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (error) throw new Error(error.message);

      await setBusinessLogo(path);
      setPreview(URL.createObjectURL(file));
      setState("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "ההעלאה נכשלה");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-edge bg-surface-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="לוגו העסק" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-7 w-7 text-ink-faint" aria-hidden />
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={state === "uploading"}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {state === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          {preview ? "החלפת לוגו" : "העלאת לוגו"}
        </button>
        <p className="mt-1.5 text-xs text-ink-muted">
          PNG עם רקע שקוף עובד הכי טוב
        </p>
        {state === "error" && (
          <p className="mt-1 text-xs text-status-overdue">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
