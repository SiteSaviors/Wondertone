#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist', 'assets');
const LIMITS = [
  { pattern: /^index-.*\.js$/, gzipLimitKb: 170 },
  { pattern: /^supabaseClient-.*\.js$/, gzipLimitKb: 130 },
  { pattern: /^StyleAccordion-.*\.js$/, gzipLimitKb: 25 },
];

const readSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
};

const toKb = (bytes) => Math.round((bytes / 1024) * 100) / 100;

const run = () => {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`[bundle-size] dist directory not found at ${DIST_DIR}`);
    process.exit(1);
  }

  const assetFiles = fs.readdirSync(DIST_DIR);

  const violations = [];

  for (const limit of LIMITS) {
    const matches = assetFiles.filter((file) => limit.pattern.test(file));
    if (matches.length === 0) {
      console.warn(`[bundle-size] No assets matched ${limit.pattern}`);
      continue;
    }

    for (const file of matches) {
      const filePath = path.join(DIST_DIR, file);
      const sizeBytes = readSize(filePath);
      if (sizeBytes == null) {
        continue;
      }
      const sizeKb = toKb(sizeBytes);
      if (sizeKb > limit.gzipLimitKb) {
        violations.push({ file, sizeKb, limit: limit.gzipLimitKb });
      }
    }
  }

  if (violations.length) {
    console.error('[bundle-size] Bundle size violations detected:');
    for (const violation of violations) {
      console.error(`  - ${violation.file}: ${violation.sizeKb} KB (limit ${violation.limit} KB)`);
    }
    process.exit(1);
  }

  console.log('[bundle-size] Bundle sizes within limits.');
};

run();
