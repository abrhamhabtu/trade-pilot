import { startProvingDaemon } from "./provingDaemon";
import { startTelegramBot } from "./telegramBot";
import { startLiveDaemon } from "./live/bots";
import { startAlertDaemon } from "./alerts";

/** Start the background loops once per server process. */
export function startDaemons() {
  startProvingDaemon();
  startLiveDaemon();
  startTelegramBot();
  startAlertDaemon();
}
