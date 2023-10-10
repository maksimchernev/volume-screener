"use strict";
require("dotenv").config();

const fs = require("fs");
const fsPromises = require("fs/promises");
const { zip } = require("zip-a-folder");
const path = require("path");

const wait = (ms = process.env.WAIT_MS || 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms));
exports.wait = wait;

function makeDir(name) {
  if (!fs.existsSync(name)) {
    fs.mkdirSync(`./${name}`);
  }
}
exports.makeDir = makeDir;

function writeInfo(type, text) {
  console[type](text);
  fs.writeFile(
    "./systemFiles/errors.txt",
    `${type.toUpperCase()}: ${text} \r\n `,
    { flag: "a+" },
    (err) => {
      if (err) {
        console.error(err);
      }
    }
  );
}
exports.writeInfo = writeInfo;

function writeChatIds(chatId, rewrite = false) {
  fs.writeFile(
    "./systemFiles/chatids.txt",
    chatId,
    !rewrite ? { flag: "a+" } : undefined,
    (err) => {
      if (err) {
        console.error(err);
      }
    }
  );
}
exports.writeChatIds = writeChatIds;

async function readChatIds() {
  try {
    const data = await fsPromises.readFile("./systemFiles/chatids.txt", "utf8");
    return data.split(",").map((i) => Number(i));
  } catch (e) {
    if (!JSON.stringify(e).match(/no such file or directory/g)) {
      writeInfo("error", `readChatIds ${e}`);
    }
    return null;
  }
}
exports.readChatIds = readChatIds;

function jsonToCsv(items) {
  const header = Object.keys(items[0]);
  const headerString = header.join(",");
  // handle null or undefined values here
  const replacer = (key, value) => value ?? "";
  const rowItems = items.map((row) =>
    header
      .map((fieldName) => JSON.stringify(row[fieldName], replacer))
      .join(",")
  );
  return [headerString, ...rowItems].join("\r\n");
}

async function writeCsv(items) {
  try {
    const csv = jsonToCsv(items);
    fs.writeFileSync(`./files/volumesdata.csv`, csv, (err) => {
      if (err) throw err;
    });

    await wait();
    await zip("./files", "./outputFiles/files.zip");
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
    writeInfo("error", `writeCsv ${e}`);
  }
}
exports.writeCsv = writeCsv;
