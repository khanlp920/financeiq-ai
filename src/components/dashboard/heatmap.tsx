"use client";
import * as React from "react";
import { fmtMoney } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** GitHub-style daily spending heatmap for the trailing ~26 weeks. */
export const SpendingHeatmap = React.memo(function SpendingHeatmap({ daily }: { daily: Map<string, number> }) {
  const { weeks, max, monthMarks } = React.useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 7 * 26);
    // align to Sunday
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: string; value: number }[][] = [];
    let week: { date: string; value: number }[] = [];
    let max = 0;
    const monthMarks: { index: number; label: string }[] = [];
    let lastMonth = -1;

    for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
      const iso = d.toISOString().slice(0, 10);
      const value = daily.get(iso) ?? 0;
      max = Math.max(max, value);
      week.push({ date: iso, value });
      if (d.getDay() === 6) { weeks.push(week); week = []; }
      if (d.getDate() <= 7 && d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        monthMarks.push({ index: weeks.length, label: d.toLocaleDateString("en-US", { month: "short" }) });
      }
    }
    if (week.length) weeks.push(week);
    return { weeks, max, monthMarks };
  }, [daily]);

  const level = (v: number) => {
    if (v <= 0) return "bg-muted";
    const r = v / (max || 1);
    if (r < 0.15) return "bg-primary/25";
    if (r < 0.35) return "bg-primary/45";
    if (r < 0.6) return "bg-primary/70";
    return "bg-primary";
  };

  return (
    <TooltipProvider delayDuration={80}>
      <div className="overflow-x-auto pb-1">
        <div className="mb-1 flex gap-[3px] pl-0 text-[10px] text-muted-foreground">
          {weeks.map((_, i) => {
            const mark = monthMarks.find((m) => m.index === i);
            return <span key={i} className="w-[13px] shrink-0">{mark?.label ?? ""}</span>;
          })}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <span className={`block h-[13px] w-[13px] rounded-[3px] ${level(day.value)}`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {day.date} · {day.value > 0 ? fmtMoney(day.value, true) : "No spending"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
});
