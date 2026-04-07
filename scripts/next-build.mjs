import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const nextBin = resolve(process.cwd(), 'node_modules/next/dist/bin/next');

const existingNodeOptions = process.env.NODE_OPTIONS || '';
const dnsOption = '--dns-result-order=ipv4first';

const hasDnsOption = existingNodeOptions
  .split(/\s+/)
  .filter(Boolean)
  .includes(dnsOption);

const nodeOptions = hasDnsOption
  ? existingNodeOptions
  : [dnsOption, existingNodeOptions].filter(Boolean).join(' ');

const child = spawn(
  process.execPath,
  [...process.argv.slice(2), nextBin, 'build', '--webpack'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  }
);

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) {
    process.stderr.write(`Build terminated by signal: ${signal}\n`);
  }
  process.exit(1);
});
