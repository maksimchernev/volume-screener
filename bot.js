"use strict";
require("dotenv").config();
const ccxt = require("ccxt");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TG_KEY;
const bot = new TelegramBot(token, { polling: true });

const binance = new ccxt.binance();
const wait = (ms = 4000) => new Promise((resolve) => setTimeout(resolve, ms));

const sync = async (chatId) => {
  try {
    const serverTime = await binance.fetchTime();
    const timeTillTheEndOfTheDay =
      1000 * 60 * 60 * 4 - (serverTime % (1000 * 60 * 60 * 4));
    const howLongWaitMs = timeTillTheEndOfTheDay - 30 * 60 * 1000;

    const message = `SYNC. Now: ${new Date()}, wait: ${
      howLongWaitMs / 1000 / 60
    }min \r\n`;
    writeInfo(message);
    bot.sendMessage(chatId, message);
    await wait(howLongWaitMs); // delay to get most accurate data in a minute frame
  } catch (e) {
    console.log(e);
  }
};

const writeInfo = (info) => {
  console.log(info);
  fs.writeFile("./errors.txt", `${info} \r\n `, { flag: "a+" }, (err) => {
    if (err) {
      console.error(err);
    }
  });
};

const getTickers = async () => {
  try {
    return await binance.fetchTickers();
  } catch (e) {
    writeInfo(`fetchTickers ${e}`);
  }
};

const getOHLCV = async (symbol, tf, limit) => {
  try {
    return await binance.fetchOHLCV(symbol, tf, undefined, limit);
  } catch (e) {
    writeInfo(`fetchOHLCV ${e}`);
  }
};

const screen = async (chatId) => {
  while (true) {
    let responseTickers = await getTickers();
    if (!responseTickers) continue;

    for (let ticker in responseTickers) {
      if (!ticker.match("USDT")) {
        continue;
      }
      const responseOHLCV = await getOHLCV(
        responseTickers[ticker].symbol,
        "1d",
        15
      );

      if (!responseOHLCV?.length) {
        await wait();
        continue;
      }

      let sum = 0;

      for (let i = responseOHLCV.length - 2; i >= 0; i--) {
        sum = sum + responseOHLCV[i][5];
      }

      let averageVolume = sum / 14;
      const diff = responseOHLCV[responseOHLCV.length - 1][5] / averageVolume;

      if (diff > 3) {
        bot.sendMessage(
          chatId,
          `${ticker} ${Math.floor(diff)} times increase in volume`
        );
      }

      await wait();
    }
    await sync(chatId);
  }
};

bot.onText(/\/start/, async (msg) => {
  let chatId = msg.chat.id;
  bot.sendMessage(
    msg.chat.id,
    "Работаю при запуске и в конце дня UTC (3am МСК). Я стал умнее, правда "
  );
  await screen(chatId);
});
