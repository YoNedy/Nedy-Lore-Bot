import { Client, REST, Routes } from "discord.js";
import { commands } from "../commands";
import { logger } from "../../lib/logger";

export function registerReadyEvent(client: Client): void {
  client.once("clientReady", async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot logged in");

    const token = process.env["DISCORD_BOT_TOKEN"]!;
    const applicationId = process.env["DISCORD_APPLICATION_ID"]!;
    const guildId = process.env["DISCORD_GUILD_ID"];

    const rest = new REST().setToken(token);
    const commandData = commands.map((cmd) => cmd.data.toJSON());

    try {
      if (guildId) {
        // Guild commands register instantly (dev mode)
        await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
          body: commandData,
        });
        logger.info({ guildId, count: commandData.length }, "Slash commands registered to guild");
      } else {
        // Global commands (up to 1 hour propagation delay)
        await rest.put(Routes.applicationCommands(applicationId), {
          body: commandData,
        });
        logger.info({ count: commandData.length }, "Slash commands registered globally");
      }
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });
}
