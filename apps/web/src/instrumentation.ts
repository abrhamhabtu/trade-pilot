// Next.js calls this once when the server starts. It starts TradePilot's
// background loops: the always-on Proving Ground, live bots and the Telegram
// bot. Set TRADEPILOT_DAEMONS=0 to run the app without them.
export async function register() {
  // Written this way so the edge bundle drops the Node-only import entirely.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.TRADEPILOT_DAEMONS === "0" || process.env.NEXT_PHASE === "phase-production-build") return;
    const { startDaemons } = await import("./lib/server/daemons");
    startDaemons();
  }
}
