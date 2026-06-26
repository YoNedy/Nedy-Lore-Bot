import {
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandBuilder,
} from "discord.js";
import * as lore from "./lore";
import * as addlore from "./addlore";
import * as removelore from "./removelore";
import * as loreboard from "./loreboard";

export interface Command {
  data: SlashCommandOptionsOnlyBuilder | SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [lore, addlore, removelore, loreboard];

export const commandMap = new Map<string, Command>(
  commands.map((cmd) => [cmd.data.name, cmd]),
);
