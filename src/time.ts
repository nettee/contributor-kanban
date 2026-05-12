const relativeTimeFormatter = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "auto",
});

const RELATIVE_TIME_DIVISIONS: Array<{
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }

  let delta = Math.round((date.getTime() - now.getTime()) / 1000);

  for (const { amount, unit } of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(delta) < amount) {
      return relativeTimeFormatter.format(delta, unit);
    }

    delta = Math.round(delta / amount);
  }

  return relativeTimeFormatter.format(delta, "year");
}
