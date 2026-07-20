import { YEARLY_FIGURES } from "@/lib/types";

/** Simple, explainable revenue forecast: run-rate projection vs the ceiling. */
export interface Forecast {
  ytd: number;
  runRateYearEnd: number;
  pctOfCeiling: number; // ytd as % of the patur ceiling
  projectedPctOfCeiling: number;
  /** null before enough data (≥ 14 days into the year with revenue). */
  reliable: boolean;
}

export function computeForecast(ytd: number, today: Date): Forecast {
  const year = today.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - startOfYear) / 86_400_000;
  const daysElapsed = Math.max(
    1,
    Math.floor((today.getTime() - startOfYear) / 86_400_000) + 1
  );

  const runRateYearEnd = (ytd / daysElapsed) * daysInYear;
  const ceiling = YEARLY_FIGURES.osekPaturCeiling;

  return {
    ytd,
    runRateYearEnd: Math.round(runRateYearEnd),
    pctOfCeiling: Math.round((ytd / ceiling) * 100),
    projectedPctOfCeiling: Math.round((runRateYearEnd / ceiling) * 100),
    reliable: daysElapsed >= 14 && ytd > 0,
  };
}
