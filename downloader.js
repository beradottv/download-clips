#!/usr/bin/env node

const readline = require("readline");
const puppeteer = require("puppeteer");
const { spawn } = require("child_process");

async function promptForURL() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Paste bera.tv link: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPlaybackIdFromPuppeteer(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page
    .goto(url, { waitUntil: "networkidle2", timeout: 60000 })
    .catch(() => {});

  // Wait a bit for the page to fully render
  await delay(3000);

  // Attempt to get the playback-id directly from <mux-player>
  const playbackId = await page.evaluate(() => {
    const muxPlayer = document.querySelector("mux-player");
    if (muxPlayer) {
      return muxPlayer.getAttribute("playback-id");
    }
    return null;
  });

  await browser.close();
  return playbackId;
}

async function downloadM3U8(m3u8Url, outputFilename = "output.mp4") {
  console.log(`\nDownloading video from ${m3u8Url}...`);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      ["-i", m3u8Url, "-map", "0", "-c", "copy", outputFilename],
      {
        stdio: "inherit",
      }
    );

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`\nDownload complete! Saved as ${outputFilename}`);
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

(async () => {
  try {
    const beraUrl = await promptForURL();
    console.log(
      "Attempting to extract playback-id directly from <mux-player> via Puppeteer..."
    );

    const playbackId = await getPlaybackIdFromPuppeteer(beraUrl);
    if (!playbackId) {
      throw new Error("Could not find playback-id in the page.");
    }

    console.log(`Found playback-id: ${playbackId}`);
    const m3u8Url = `https://stream.mux.com/${playbackId}.m3u8?redundant_streams=true`;
    console.log(`Constructed M3U8 URL: ${m3u8Url}`);

    // Download directly using ffmpeg with -map 0 to include all streams
    await downloadM3U8(m3u8Url);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
