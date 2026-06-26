import { client } from "./client";
import { registerReadyEvent } from "./events/ready";
import { registerMessageCreateEvent } from "./events/messageCreate";
import { registerInteractionCreateEvent } from "./events/interactionCreate";
import { logger } from "../lib/logger";

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
    return;
  }

  const applicationId = process.env["DISCORD_APPLICATION_ID"];
  if (!applicationId) {
    logger.warn("DISCORD_APPLICATION_ID not set — Discord bot will not start");
    return;
  }

  registerReadyEvent(client);
  registerMessageCreateEvent(client);
  registerInteractionCreateEvent(client);

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.on("warn", (info) => {
    logger.warn({ info }, "Discord client warning");
  });

  await client.login(token);
  logger.info("Discord bot login initiated");
}

export { client };
