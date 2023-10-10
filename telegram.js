"use strict";
require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TG_KEY;
const bot = new TelegramBot(token, { polling: true });

const {
  writeChatIds,
  readChatIds,
  makeDir,
  writeInfo,
} = require("./functions");
const { screen } = require("./screener");

let isStarted = false;

async function sendMsgsToChatIds(msg) {
  const chatIds = await readChatIds();
  chatIds.forEach((id) => {
    bot.sendMessage(id, msg);
  });
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIds = await readChatIds();

  makeDir("outputFiles");
  makeDir("systemFiles");

  if (!chatIds?.includes(chatId)) {
    writeChatIds(`${isStarted ? "," : ""}${chatId}`);
  }

  if (!isStarted) {
    isStarted = true;
    screen(sendMsgsToChatIds);
  }

  bot.sendMessage(
    chatId,
    "Работаю в конце дня UTC (3am МСК). Я стал умнее, правда "
  );
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIds = await readChatIds();

  if (!chatIds?.includes(chatId)) {
    return;
  }
  writeChatIds(chatIds.filter((id) => id !== chatId).join(","), true);
  writeInfo("log", `${chatId} unsubscribed`);
  bot.sendMessage(chatId, "Пока пока");
});

bot.onText(/\/getcsv/, (msg) => {
  bot.sendDocument(msg.chat.id, "./outputFiles/files.zip");
});
