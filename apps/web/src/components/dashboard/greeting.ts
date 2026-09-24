/** Which greeting fits the time in India: morning before 12, afternoon before 5 pm, then evening */
export function greetingKey(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    }).format(now),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** First name for a friendly greeting: "Asha Sharma" -> "Asha" */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
