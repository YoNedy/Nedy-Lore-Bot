import { Client, Interaction, DiscordAPIError } from "discord.js";
import { commandMap } from "../commands";
import { logger } from "../../lib/logger";

const INTERACTION_MAX_AGE_MS = 2_500;

export function registerInteractionCreateEvent(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const age = Date.now() - interaction.createdTimestamp;
    if (age > INTERACTION_MAX_AGE_MS) {
      logger.warn({ commandName: interaction.commandName, ageMs: age }, "Dropping stale interaction");
      return;
    }

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, "Unknown slash command received");
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      const isUnknownInteraction = err instanceof DiscordAPIError && err.code === 10062;
      if (isUnknownInteraction) {
        logger.warn({ commandName: interaction.commandName }, "Interaction expired before bot could respond");
        return;
      }

      logger.error({ err, commandName: interaction.commandName }, "Error executing slash command");
      const reply = { content: "❌ Something went wrong while executing that command.", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });
}
