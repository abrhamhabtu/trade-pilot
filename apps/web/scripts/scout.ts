// Runs the strategy scout over the data library and prints each verdict:
//   npm run lab:scout
// New candidates go in ~/.tradepilot/library/lab/scout-candidates.json. Finished
// ones aren't run again. Nothing joins your strategies until you approve it in the app.

import { getScout, scout } from "../src/lib/server/library/lab";

const job = { key: "scout", stage: "", done: 0, total: 1 };
let last = "";
const tick = setInterval(() => {
  if (job.stage !== last) console.log(`${job.done}/${job.total} ${job.stage}`);
  last = job.stage;
}, 2000);
await scout(job);
clearInterval(tick);
const { results } = await getScout();
for (const r of results) console.log(`${r.verdict.padEnd(11)} ${r.symbol} ${r.name}: ${r.reason}`);
