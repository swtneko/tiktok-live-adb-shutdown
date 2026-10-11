#!/usr/bin/env node
/**
 * TikTok Live Monitor → ADB Reboot
 * Tương thích tiktok-live-connector v2+ (dùng TikTokLiveConnection)
 *
 * Cài đặt: npm install tiktok-live-connector
 * Chạy:    node index.js <tiktok_username> [adb_serial_hoặc_ip:port]
 */

const { TikTokLiveConnection } = require("tiktok-live-connector");
const { execSync, spawnSync }   = require("child_process");
const fs                        = require("fs");

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const RECONNECT_DELAY_MS  = 10_000;
const REBOOT_CONFIRM_MS   = 5_000;
const MAX_RECONNECT_TRIES = 5;
const LOG_FILE            = "tiktok_adb_shutdown.log";

// ─────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────
function log(level, msg) {
  const line = `${new Date().toISOString()} [${level}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}
const info  = (m) => log("INFO ", m);
const warn  = (m) => log("WARN ", m);
const error = (m) => log("ERROR", m);

// ─────────────────────────────────────────
// ADB HELPERS
// ─────────────────────────────────────────
function adbDevices() {
  try {
    const out = execSync("adb devices", { encoding: "utf8" });
    return out
      .split("\n")
      .slice(1)
      .map((l) => l.split("\t"))
      .filter(([, state]) => state?.trim() === "device")
      .map(([serial]) => serial.trim());
  } catch (e) {
    error(`adb devices thất bại: ${e.message}`);
    return [];
  }
}

function adbConnect(ipPort) {
  try {
    const out = execSync(`adb connect ${ipPort}`, { encoding: "utf8" });
    info(`adb connect ${ipPort}: ${out.trim()}`);
    return out.toLowerCase().includes("connected");
  } catch (e) {
    warn(`adb connect ${ipPort} lỗi: ${e.message}`);
    return false;
  }
}

function adbReboot(deviceTarget) {
  info(`🔄 Gửi lệnh reboot tới: ${deviceTarget}`);
  const result = spawnSync("adb", ["-s", deviceTarget, "reboot"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (result.status === 0) {
    info("✅ adb reboot thành công.");
  } else {
    error(`❌ adb reboot thất bại: ${result.stderr}`);
  }
}

function resolveDevice(target, wifiIp) {
  if (wifiIp) adbConnect(wifiIp);
  if (target) return target;

  const devices = adbDevices();
  if (devices.length === 0) {
    error("Không tìm thấy thiết bị ADB nào!");
    process.exit(1);
  }
  info(`Tự động chọn thiết bị: ${devices[0]}`);
  return devices[0];
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
const args      = process.argv.slice(2);
const username  = args[0];
const adbTarget = args[1] || null;

if (!username) {
  console.error("Cách dùng: node index.js <tiktok_username> [adb_serial_hoặc_ip:port]");
  process.exit(1);
}

const wifiIp = adbTarget && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(adbTarget)
  ? adbTarget : null;

const device = resolveDevice(adbTarget, wifiIp);

info("=".repeat(60));
info(`TikTok Live Monitor khởi động`);
info(`  Username   : @${username}`);
info(`  ADB target : ${device}`);
info("=".repeat(60));

// ─── TikTok Connection ──────────────────
let reconnectCount  = 0;
let rebootScheduled = false;
let tiktok          = null;

function scheduleReboot() {
  if (rebootScheduled) return;
  rebootScheduled = true;
  info(`Chờ ${REBOOT_CONFIRM_MS / 1000}s xác nhận rồi reboot...`);
  setTimeout(() => {
    if (wifiIp) adbConnect(wifiIp);
    const devices = adbDevices();
    if (!devices.includes(device)) {
      error(`Thiết bị ${device} không thấy trong ADB! Hiện có: ${devices.join(", ")}`);
      return;
    }
    adbReboot(device);
    info("✅ Đã reboot điện thoại. Shutdown máy tính sau 60 giây...");
    setTimeout(() => {
      const cmd = process.platform === "win32"
        ? "shutdown /s /t 0"
        : "sudo shutdown -h now";
      execSync(cmd);
    }, 60_000);
  }, REBOOT_CONFIRM_MS);
}

function handleReconnect() {
  if (rebootScheduled) return;
  if (reconnectCount >= MAX_RECONNECT_TRIES) {
    warn(`Thử reconnect ${MAX_RECONNECT_TRIES} lần không được → coi như stream kết thúc.`);
    scheduleReboot();
    return;
  }
  reconnectCount++;
  warn(`Reconnect lần ${reconnectCount}/${MAX_RECONNECT_TRIES} sau ${RECONNECT_DELAY_MS / 1000}s...`);
  setTimeout(connect, RECONNECT_DELAY_MS);
}

function connect() {
  tiktok = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
  });

  tiktok.on("connected", (state) => {
    reconnectCount  = 0;
    rebootScheduled = false;
    info(`🟢 Đã kết nối live @${username} | roomId: ${state?.roomId ?? "unknown"}`);
  });

  tiktok.on("streamEnd", () => {
    info(`🔴 streamEnd — stream đã kết thúc.`);
    scheduleReboot();
  });

  tiktok.on("disconnected", () => {
    warn("WebSocket ngắt kết nối.");
    if (!rebootScheduled) handleReconnect();
  });

  tiktok.on("error", (err) => {
    const msg = String(err?.message || err?.info || err || "").toLowerCase();
    error(`Lỗi: ${msg}`);
    if (
      msg.includes("live_not_found") ||
      msg.includes("room_not_found") ||
      msg.includes("ended") ||
      msg.includes("not live")
    ) {
      scheduleReboot();
    } else if (!rebootScheduled) {
      handleReconnect();
    }
  });

  tiktok.connect().catch((err) => {
    const msg = String(err?.message || err || "").toLowerCase();
    error(`Không kết nối được: ${msg}`);
    if (
      msg.includes("not live") ||
      msg.includes("ended") ||
      msg.includes("not_found")
    ) {
      scheduleReboot();
    } else {
      handleReconnect();
    }
  });
}

connect();