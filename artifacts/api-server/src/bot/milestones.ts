export interface Milestone {
  count: number;
  lore: string;
}

export const MILESTONES: Milestone[] = [
  {
    count: 100,
    lore: "First made their mark with a humble 100 messages. The elders took notice.",
  },
  {
    count: 500,
    lore: "Has sent 500 messages into the void. Disturbingly, the void has started responding.",
  },
  {
    count: 1000,
    lore: "After 1,000 messages, legally required to attend all server meetups. No exceptions.",
  },
  {
    count: 5000,
    lore: "5,000 messages in. Scholars debate whether they sleep or simply reload Discord between naps.",
  },
  {
    count: 10000,
    lore: "10,000 messages strong. Songs have been written. Temples erected. Villagers whisper their name.",
  },
  {
    count: 25000,
    lore: "25,000 messages documented. The server historians have run out of ink. A new era begins.",
  },
  {
    count: 50000,
    lore: "50,000 messages. At this point they ARE the server. The server is them. We live inside their chat.",
  },
];

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
