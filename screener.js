"use strict";
require("dotenv").config();

const ccxt = require("ccxt");
const binance = new ccxt.binance();

const { wait, writeInfo, writeCsv } = require("./functions");

async function sync(sendMsgsToChatIds) {
  try {
    const serverTime = await binance.fetchTime();
    const timeTillTheEndOfTheDay =
      1000 * 60 * 60 * process.env.ONCE_UPON -
      (serverTime % (1000 * 60 * 60 * process.env.ONCE_UPON));

    const howLongWaitMs = timeTillTheEndOfTheDay - 30 * 60 * 1000;

    const msg = `SYNC. Now: ${new Date()}, wait: ${
      howLongWaitMs / 1000 / 60
    }min \r\n`;

    writeInfo("log", msg);

    sendMsgsToChatIds(msg);

    await wait(howLongWaitMs); // delay to get most accurate data in a minute frame
  } catch (e) {
    writeInfo("error", `sync ${e}`);
  }
}

async function getTickers() {
  try {
    return await binance.fetchTickers();
  } catch (e) {
    writeInfo("error", `fetchTickers ${e}`);
  }
}

async function getOHLCV(symbol, tf, limit) {
  try {
    return await binance.fetchOHLCV(symbol, tf, undefined, limit);
  } catch (e) {
    writeInfo("error", `getOHLCV ${e}`);
  }
}

async function screen(sendMsgsToChatIds) {
  while (true) {
    const volumesData = [];

    writeInfo("log", `Started. Now: ${new Date()}`);

    const responseTickers = await getTickers();

    if (!responseTickers) continue;

    for (const ticker in responseTickers) {
      if (
        !ticker.match("USDT") ||
        ticker.match("UPUSDT") ||
        ticker.match("DOWNUSDT")
      ) {
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
        sendMsgsToChatIds(
          `${ticker} ${Math.floor(diff)} times increase in volume`
        );
      }

      await wait();
    }

    writeCsv(volumesData);

    await sync(sendMsgsToChatIds);
  }
}
exports.screen = screen;
