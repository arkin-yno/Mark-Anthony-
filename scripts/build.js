import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for (const file of ['public/index.html','public/styles.css','public/favicon.svg','vercel.json']) await access(file);
for (const file of ['public/app.js','public/cloud-api.js','api/config.js']) execFileSync(process.execPath,['--check',file]);
const config = JSON.parse(await readFile('vercel.json','utf8'));
if(config.framework !== null) throw new Error('Vercel must use the Other preset to serve the static website.');
if(config.outputDirectory !== 'public') throw new Error('Deploy only the public directory.');
console.log('Portfolio deployment files validated. Static website and configuration endpoint are ready.');
