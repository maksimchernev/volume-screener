"use strict";

require("dotenv").config();
const ccxt = require("ccxt");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TG_KEY;
const bot = new TelegramBot(token, { polling: true });

const binance = new ccxt.binance();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sync = async () => {
  let serverTime = await binance.fetchTime();
  let timeTillTheEndOfTheDay =
    1000 * 60 * 60 * 4 - (serverTime % (1000 * 60 * 60 * 4));
  await wait(timeTillTheEndOfTheDay - 30 * 60 * 1000); // delay to get most accurate data in a minute frame
};

const screen = async (chatId) => {
  while (true) {
    const responseTickers = await binance.fetchTickers();
    for (let ticker in responseTickers) {
      if (ticker.match("USDT")) {
        const responseOHLCV = await binance.fetchOHLCV(
          responseTickers[ticker].symbol,
          "1d",
          undefined,
          15
        );
        let sum = 0;
        for (let i = responseOHLCV.length - 2; i >= 0; i--) {
          sum = sum + responseOHLCV[i][5];
        }
        let averageVolume = sum / 14;
        const diff = responseOHLCV[responseOHLCV.length - 1][5] / averageVolume;
        console.log("working", new Date());
        if (diff > 3) {
          bot.sendMessage(
            chatId,
            `${ticker} ${Math.floor(diff)} times increase in volume`
          );
        }

        await wait(3000);
      }
    }
    await sync();
  }

  //console.log(response)
};

bot.onText(/\/start/, async (msg) => {
  let chatId = msg.chat.id;
  bot.sendMessage(
    msg.chat.id,
    "At the end of 1d candle I will start screening. Patience...."
  );
  await screen(chatId);
});
