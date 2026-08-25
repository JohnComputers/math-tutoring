#!/usr/bin/env node
/**
 * Kill stale Firebase emulator processes still holding their ports.
 *
 * On Windows the emulator CLI forwards SIGINT to itself but the Java child process it
 * spawned frequently survives, so the next `emulators:exec` fails with "port taken".
 * This clears the ports first so a test run never fails for a reason unrelated to the
 * code under test.
 *
 * Only processes listening on the emulator's own ports are touched, and each is checked
 * to be a Java or Node process before being killed — this will not stop an unrelated
 * server that happens to be on 8080.
 */

import { execSync } from 'node:child_process';

const PORTS = [8080, 9099, 9199, 4400, 4500, 9150];
const isWindows = process.platform === 'win32';

/** PIDs listening on a port. */
function pidsOnPort(port) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano -p TCP | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return [
        ...new Set(
          output
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/).pop())
            .filter((pid) => pid && /^\d+$/.test(pid) && pid !== '0'),
        ),
      ];
    }
    const output = execSync(`lsof -ti tcp:${port} -s tcp:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split(/\s+/).filter(Boolean);
  } catch {
    return []; // nothing listening
  }
}

/** The executable name for a pid, so we only kill emulator-shaped processes. */
function processName(pid) {
  try {
    if (isWindows) {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return (output.split(',')[0] ?? '').replace(/"/g, '').trim().toLowerCase();
    }
    return execSync(`ps -p ${pid} -o comm=`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

function kill(pid) {
  try {
    if (isWindows) execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

let killed = 0;
for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) {
    const name = processName(pid);
    // Emulators run as java (Firestore, Storage) or node (Auth, hub).
    if (!/java|node/.test(name)) {
      console.log(`  port ${port}: leaving PID ${pid} (${name || 'unknown'}) alone`);
      continue;
    }
    if (kill(pid)) {
      console.log(`  port ${port}: stopped stale ${name} (PID ${pid})`);
      killed += 1;
    }
  }
}

console.log(
  killed === 0 ? 'Emulator ports are already free.' : `Freed ${killed} stale emulator process(es).`,
);
