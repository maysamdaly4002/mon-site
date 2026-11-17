#!/usr/bin/env node
/*! create-snapify — © 2026 NOVALABS WEB DESIGN — licence : LICENSE.md */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const manifest = require.resolve('snapify-sdk/package.json');
const cli = path.join(path.dirname(manifest), require(manifest).bin.snapify);
const result = spawnSync(process.execPath, [cli, 'create', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
