export interface Milestone {
  count: number;
  lore: string;
}

// Rotating lore templates for every-100-message milestones.
// The milestone count is substituted where {count} appears.
const HUNDRED_TEMPLATES = [
  "{count} messages in. The keyboard fears them.",
  "Witnesses confirm {count} messages sent. The server has filed a noise complaint.",
  "{count} messages deep. Historians have started taking notes.",
  "The count reaches {count}. Someone send help.",
  "{count} messages. At this rate, they'll outlast the server itself.",
  "Another {count} messages logged. The void keeps responding.",
  "{count} messages strong. Still no signs of slowing down.",
  "Scientists estimate {count} messages represents approximately one week of their thoughts.",
  "{count} messages. The mods have accepted their fate.",
  "Breaking: local member sends {count}th message. Observers stunned.",
];

// Special milestone overrides for particularly round numbers
const SPECIAL_MILESTONES: Record<number, string> = {
  100: "First made their mark with a humble 100 messages. The elders took notice.",
  500: "Has sent 500 messages into the void. Disturbingly, the void has started responding.",
  1000: "After 1,000 messages, legally required to attend all server meetups. No exceptions.",
  2000: "2,000 messages in. A monument was proposed. Funding is pending.",
  5000: "5,000 messages deep. Scholars debate whether they sleep or simply reload Discord between naps.",
  10000: "10,000 messages strong. Songs have been written. Temples erected. Villagers whisper their name.",
  25000: "25,000 messages documented. The server historians have run out of ink. A new era begins.",
  50000: "50,000 messages. At this point they ARE the server. The server is them. We live inside their chat.",
};

function getLoreForCount(count: number): string {
  if (SPECIAL_MILESTONES[count]) {
    return SPECIAL_MILESTONES[count]!;
  }
  // Pick a template based on which 100-step this is (cycles through templates)
  const index = Math.floor(count / 100) % HUNDRED_TEMPLATES.length;
  const template = HUNDRED_TEMPLATES[index]!;
  return template.replace("{count}", count.toLocaleString());
}

// Generate milestones every 100 messages up to 50,000
export const MILESTONES: Milestone[] = Array.from(
  { length: 500 },
  (_, i) => {
    const count = (i + 1) * 100;
    return { count, lore: getLoreForCount(count) };
  },
);

export function getMilestone(
  previousCount: number,
  newCount: number,
): Milestone | null {
  for (const milestone of MILESTONES) {
    if (previousCount < milestone.count && newCount >= milestone.count) {
      return milestone;
    }
  }
  return null;
}
