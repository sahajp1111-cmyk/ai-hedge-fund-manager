import { config } from "./config.js";
import { Store } from "./store.js";
import { Worker } from "./worker.js";
import { EodData } from "./data.js";
import { createApp } from "./app.js";
const store = new Store(config.DATA_DIR);
await store.init();
const worker = new Worker(store, new EodData(config.EODHD_API_TOKEN), {
  batch: config.SCAN_BATCH_SIZE,
  webhook: config.NOTIFICATION_WEBHOOK_URL,
  secret: config.NOTIFICATION_WEBHOOK_SECRET,
  telegram: config.TELEGRAM_BOT_TOKEN
    ? { token: config.TELEGRAM_BOT_TOKEN, chatId: config.TELEGRAM_CHAT_ID! }
    : undefined,
});
const server = createApp(store, worker).listen(config.PORT, config.host, () =>
  console.log(
    `SignalDesk listening on ${config.host}:${config.PORT}; research only`,
  ),
);
if (config.SCANNER_ENABLED === "true")
  worker.start(config.SCAN_INTERVAL_MINUTES);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await worker.stop();
  await store.close();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
