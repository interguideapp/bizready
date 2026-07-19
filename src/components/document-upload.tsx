"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { addDocument } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

/** Uploads a file to storage under the user's folder, then records metadata. */
export function DocumentUpload({
  category,
  taskId = null,
  label = "העלאת מסמך",
  compact = false,
}: {
  category: string;
  taskId?: string | null;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onFile(file: File) {
    setState("uploading");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("לא מחוברים");

      const safeName = file.name.replace(/[^\w.\-֐-׿]/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (error) throw new Error(error.message);

      await addDocument({
        category,
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        task_id: taskId,
      });
      setState("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "ההעלאה נכשלה");
      setState("error");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
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
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        }
      >
        {state === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="h-4 w-4" aria-hidden />
        )}
        {state === "uploading" ? "מעלה..." : label}
      </button>
      {state === "error" && (
        <p className="mt-1.5 text-xs text-status-overdue">{errorMsg}</p>
      )}
    </div>
  );
}
