import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  Flame,
  FolderCheck,
  Footprints,
  Landmark,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints, Landmark, Rocket, FileCheck2, FolderCheck, BadgeCheck,
  ShieldCheck, Flame, TrendingUp, Trophy, Sparkles,
};
function Ic({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

export interface TrophyBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
}

export function TrophyWall({
  badges,
  wins,
}: {
  badges: TrophyBadge[];
  wins: { templateId: string; title: string }[];
}) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  const pct = badges.length > 0 ? Math.round((earned.length / badges.length) * 100) : 0;

  return (
    <Card className="h-full p-5">
      {/* header + progress */}
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-section text-ink">
          <Trophy className="h-4.5 w-4.5 text-status-progress" aria-hidden />
          קיר ההישגים
        </h2>
        <span className="tnum text-sm font-bold text-ink">
          {earned.length}
          <span className="text-ink-faint">/{badges.length}</span>
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-500 to-accent-to"
          style={{ width: `${pct}%`, boxShadow: "0 0 10px var(--accent-glow)" }}
        />
      </div>

      {/* earned — prominent */}
      {earned.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {earned.map((b) => (
            <div
              key={b.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-brand-edge bg-brand-tint/40 p-3 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-to text-white shadow-e-brand">
                <Ic name={b.icon} className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold leading-tight text-ink">{b.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* locked — secondary, with unlock hint */}
      {locked.length > 0 && (
        <div>
          <p className="eyebrow mb-2">בדרך אליך</p>
          <div className="flex flex-col gap-2">
            {locked.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-2.5 rounded-xl border border-edge-soft bg-surface/30 p-2.5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-faint">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-soft">{b.title}</p>
                  <p className="text-[11px] leading-tight text-ink-muted">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* recent wins */}
      {wins.length > 0 && (
        <div className="mt-4 border-t border-edge-soft pt-3">
          <p className="eyebrow mb-2">נצחונות אחרונים</p>
          <div className="flex flex-wrap gap-1.5">
            {wins.slice(0, 10).map((w) => (
              <Link
                key={w.templateId}
                href={`/tasks/${w.templateId}`}
                className="inline-flex items-center gap-1 rounded-full border border-edge-soft bg-surface/40 px-2.5 py-1 text-xs text-ink-soft transition hover:border-brand-edge"
              >
                <CheckCircle2 className="h-3 w-3 text-status-done" aria-hidden />
                {w.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
