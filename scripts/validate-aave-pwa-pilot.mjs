import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AAVE_USDC,AAVE_POOL,parsePilotDecimal,validateAavePilotQuote,
  sendAavePilotStep,getAavePilotReceipt,
} from '../src/aavePilotWallet.js';

const WALLET='0x1111111111111111111111111111111111111111';
const HASH='0x'+'a'.repeat(64);
const blockHash='0x'+'b'.repeat(64);
const wordA=a=>a.toLowerCase().slice(2).padStart(64,'0');
const wordN=n=>BigInt(n).toString(16).padStart(64,'0');
const approval='0x095ea7b3'+wordA(AAVE_POOL)+wordN(5_000_000n);
const supply='0x617ba037'+wordA(AAVE_USDC)+wordN(5_000_000n)+wordA(WALLET)+wordN(0);
const withdraw='0x69328dec'+wordA(AAVE_USDC)+wordN(5_000_000n)+wordA(WALLET);
const step=(kind,to,data)=>({
  kind,to,from:WALLET,data,value:'0x0',chainId:137,requiresExplicitWalletConfirmation:true,
});
function quote(action,steps){
  return {
    success:true,mode:'USER_SIGNED_AAVE_PILOT',transactionPrepared:true,
    transactionSent:false,executionEnabledOnServer:false,
    requiresExplicitWalletConfirmation:true,chainId:137,action,
    walletAddress:WALLET,amountBaseUnits:'5000000',
    expiresAt:new Date(Date.now()+30000).toISOString(),
    quote:{steps},
  };
}
const s=quote('SUPPLY',[
  step('APPROVAL',AAVE_USDC,approval),
  step('SUPPLY',AAVE_POOL,supply),
]);
const w=quote('WITHDRAW',[step('WITHDRAW',AAVE_POOL,withdraw)]);
assert.equal(parsePilotDecimal('1'),1000000n);
assert.equal(parsePilotDecimal('100'),100000000n);
for(const x of ['0','0.1','100.000001','101','1e9','-1','1.0000001']){
  assert.throws(()=>parsePilotDecimal(x));
}
assert.equal(validateAavePilotQuote(s,WALLET).length,2);
assert.equal(validateAavePilotQuote(w,WALLET).length,1);
for(const invalid of [
  {...s,chainId:1},
  {...s,transactionSent:true},
  {...s,expiresAt:new Date(Date.now()-1000).toISOString()},
  {...s,walletAddress:'0x2222222222222222222222222222222222222222'},
  {...s,quote:{steps:[step('APPROVAL',AAVE_USDC,approval.replace(/.$/,'f')),
    step('SUPPLY',AAVE_POOL,supply)]}},
  {...s,quote:{steps:[step('APPROVAL',WALLET,approval),step('SUPPLY',AAVE_POOL,supply)]}},
  {...s,quote:{steps:[step('APPROVAL',AAVE_USDC,approval),
    step('BORROW',AAVE_POOL,supply)]}},
]){
  assert.throws(()=>validateAavePilotQuote(invalid,WALLET));
}
let requests=[];
const provider={
  async request({method,params}){
    requests.push({method,params});
    if(method==='eth_chainId')return '0x89';
    if(method==='eth_sendTransaction')return HASH;
    if(method==='eth_getTransactionReceipt')return {
      transactionHash:HASH,from:WALLET,to:AAVE_USDC,blockHash,status:'0x1',
    };
    throw Error('Unapproved provider method '+method);
  },
};
const result=await sendAavePilotStep(provider,s,WALLET);
assert.equal(result.hash,HASH);
assert.equal(result.step.kind,'APPROVAL');
assert.deepEqual(requests.map(x=>x.method),['eth_chainId','eth_sendTransaction']);
assert.equal(requests[1].params.length,1);
assert.equal(requests[1].params[0].to.toLowerCase(),AAVE_USDC);
assert.equal(requests[1].params[0].value,'0x0');
assert.equal(await getAavePilotReceipt(provider,HASH,WALLET,AAVE_USDC),'confirmed');
const wrongChain={request:async({method})=>method==='eth_chainId'?'0x1':null};
await assert.rejects(()=>sendAavePilotStep(wrongChain,s,WALLET),/Polygon/);
const badReceipt={request:async()=>({
  transactionHash:HASH,from:WALLET,to:WALLET,blockHash,status:'0x1',
})};
await assert.rejects(()=>getAavePilotReceipt(badReceipt,HASH,WALLET,AAVE_USDC));
const screen=fs.readFileSync('src/AaveRealWallet.jsx','utf8');
const app=fs.readFileSync('src/App.jsx','utf8');
assert.ok(app.includes('<AaveRealWallet accessToken={session.accessToken} apiUrl={API_URL} />'));
assert.ok(screen.includes('status?.pilotEnabled'));
assert.ok(screen.includes('riskAcknowledged:true'));
assert.ok(screen.includes('confirmar')||screen.includes('confirm'));
assert.ok(!screen.includes('privateKey'));
assert.ok(!screen.includes('eth_sendRawTransaction'));
console.log('Aave PWA pilot QA PASS: exact USDC, calldata, gated client signing, explicit approval, receipts, no auto-send.');
