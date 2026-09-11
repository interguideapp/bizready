"use client";

/**
 * Last-resort boundary (replaces the root layout when it is the thing that
 * failed), so even a catastrophic error stays Hebrew and RTL.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060911",
          color: "#f2f5ff",
          fontFamily: "Heebo, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>המערכת נתקלה בתקלה</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#d2dbef", marginBottom: 24 }}>
            הנתונים שלכם לא נפגעו. נסו לטעון מחדש.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#4f46e5",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            לנסות שוב
          </button>
        </div>
      </body>
    </html>
  );
}
