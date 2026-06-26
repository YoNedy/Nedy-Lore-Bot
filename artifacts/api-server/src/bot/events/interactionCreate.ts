import { Client, Interaction } from "discord.js";
import { commandMap } from "../commands";
import { logger } from "../../lib/logger";

export function registerInteractionCreateEvent(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, "Unknown slash command received");
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
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
