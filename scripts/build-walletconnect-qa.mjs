import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

if (process.env.VITE_WALLET_CONNECT_LAB_ENABLED !== 'true' ||
    process.env.VITE_WALLET_CONNECT_QA_INJECTED !== 'true' ||
    process.env.VITE_WALLET_CONNECT_LAB_API_URL !==
      'https://nexa-walletconnect-qa-api.onrender.com/api/v1' ||
    process.env.VITE_WALLET_CONNECT_BR_TRUSTED_DOMAIN !==
      'nexa-walletconnect-qa-web.onrender.com' ||
    process.env.VITE_WALLET_CONNECT_GLOBAL_TRUSTED_DOMAIN !==
      'nexa-walletconnect-qa-web.onrender.com') {
  throw new Error('QA_BUILD_ENVIRONMENT_INVALID');
}
const vite=path.resolve('node_modules/vite/bin/vite.js');
const p=spawnSync(process.execPath,[vite,'build','--config','vite.walletconnect-qa.config.js'],{
  stdio:'inherit',env:process.env,
});
if(p.error)throw p.error;
if(p.status!==0)process.exit(p.status||1);
const qaFile=path.resolve('dist/qa-entry.html');
const html=fs.readFileSync(qaFile,'utf8');
if(!html.includes('Nexa Wallet Connect') || !html.includes('/assets/')) {
  throw new Error('QA_ENTRY_OUTPUT_MISSING');
}
fs.writeFileSync(path.resolve('dist/index.html'),html);
fs.rmSync(qaFile);
const entries=fs.readdirSync(path.resolve('dist/assets'));
if(!entries.some(x=>x.endsWith('.js')))throw new Error('QA_BUILD_MISSING_JS');
for(const filename of entries){
  if(!filename.endsWith('.js'))continue;
  const content=fs.readFileSync(path.resolve('dist/assets',filename),'utf8');
  for(const forbidden of [
    'nexa-backend-p2u0.onrender.com',
    'cmpen2gm3007v0cjswjlyefji',
    'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcSgXg6CWaMyT',
    'PRIVY_APP_SECRET',
    'PRIVY_SECRET_KEY',
    'eth_sendTransaction',
    'wallet_sendCalls',
    'wallet_sendTransaction',
    'eth_signTypedData_v4',
    'wallet_requestPermissions',
    'setApprovalForAll(',
  ]){
    if(content.includes(forbidden))throw new Error('FORBIDDEN_QA_BUNDLE_STRING '+forbidden);
  }
}
console.log('NEXA_WALLETCONNECT_QA_ISOLATED_BUNDLE PASS');
