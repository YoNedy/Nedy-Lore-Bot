import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // Note: GuildMembers is a privileged intent — only add it if enabled
    // in the Discord Developer Portal under Bot > Privileged Gateway Intents
  ],
});
