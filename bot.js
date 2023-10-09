"use strict";
require("dotenv").config();
const ccxt = require("ccxt");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TG_KEY;
const bot = new TelegramBot(token, { polling: true });
const { zip } = require("zip-a-folder");
const path = require("path");

const binance = new ccxt.binance();
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function writeCsv(items) {
  const header = Object.keys(items[0]);
  const headerString = header.join(",");
  // handle null or undefined values here
  const replacer = (key, value) => value ?? "";
  const rowItems = items.map((row) =>
    header
      .map((fieldName) => JSON.stringify(row[fieldName], replacer))
      .join(",")
  );
  const csv = [headerString, ...rowItems].join("\r\n");

  try {
    fs.writeFileSync(`./files/volumesdata.csv`, csv, (err) => {
      if (err) throw err;
    });

    await wait();
    await zip("./files", "./files.zip");
    await wait();

    fs.readdir("./files", (err, files) => {
      if (err) throw err;
      for (const file of files) {
        fs.unlink(path.join("./files", file), (err) => {
          if (err) throw err;
        });
      }
    });
  } catch (e) {
    writeInfo(`zippin ${e}`);
  }
}

const screen = async (chatId) => {
  while (true) {
    const volumesData = [];

    writeInfo(`Started. Now: ${new Date()}`);

    const responseTickers = await getTickers();

    if (!responseTickers) continue;

    for (const ticker in responseTickers) {
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
        sum += responseOHLCV[i][5];
      }

      const averageVolume = sum / 14;
      const diff = responseOHLCV[responseOHLCV.length - 1][5] / averageVolume;

      //for csv
      volumesData.push({
        ticker,
        volume: responseOHLCV[responseOHLCV.length - 1][5],
      });

      if (diff > 3) {
        bot.sendMessage(
          chatId,
          `${ticker} ${Math.floor(diff)} times increase in volume`
        );
      }

      await wait();
    }

    writeCsv(volumesData, chatId);

    await sync(chatId);
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    msg.chat.id,
    "Работаю при запуске и в конце дня UTC (3am МСК). Я стал умнее, правда "
  );
  await screen(chatId);
});

bot.onText(/\/getcsv/, async (msg) => {
  bot.sendDocument(msg.chat.id, "./files.zip");
});
