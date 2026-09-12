import { mkdir, writeFile } from 'node:fs/promises';
import { runAll } from '../src/experiment.js';

const seed = Number(process.argv[2] ?? 23);
const result = runAll(seed);
const receipt = {
  seed: result.seed,
  schedule: result.schedule,
  config: result.config,
  ordinary: result.ordinary,
  thirdway: result.thirdway,
  criteria: result.criteria,
  verdict: result.verdict
};
await mkdir(new URL('../results/', import.meta.url), { recursive: true });
const out = new URL(`../results/seed${seed}.json`, import.meta.url);
await writeFile(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
console.log(`wrote ${out.pathname}`);
