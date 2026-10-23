import assert from 'node:assert/strict';
import {
  requireQaUrl,verifiedAddress,walletLabel,activeAccount,requirePolygon,
  signCanonicalQaChallenge,
} from '../src/walletConnectInjected.mjs';

const good='https://nexa-walletconnect-qa-api.onrender.com/api/v1';
assert.equal(requireQaUrl(good),good);
for(const bad of [
  'https://nexa-backend-p2u0.onrender.com/api/v1',
  'https://nexa-walletconnect-qa-api.onrender.com/api/v1/extra',
  'https://nexa-walletconnect-qa-api.onrender.com/api/v1?evil=1',
  'https://nexa-walletconnect-qa-api.onrender.com/api/v1#token',
  'https://name:password@nexa-walletconnect-qa-api.onrender.com/api/v1',
  'http://nexa-walletconnect-qa-api.onrender.com/api/v1',
  'https://nexa-walletconnect-qa-api.onrender.com.evil.example/api/v1',
]){
 assert.throws(()=>requireQaUrl(bad));
}
assert.equal(verifiedAddress('0x'+'A'.repeat(40)),'0x'+'a'.repeat(40));
assert.throws(()=>verifiedAddress('0x123'));
assert.ok(!walletLabel('<img src=x onerror=1>').includes('<'));
const address='0x'+'2'.repeat(40);
const domain='nexa-walletconnect-qa-web.onrender.com';
const issued='2026-10-23T23:03:00.000Z';
const expiry='2026-10-23T23:08:00.000Z';
const nonce='a'.repeat(64);
const message=[
 domain+' wants you to sign in with your Ethereum account:',address,'',
 'Sign in to the Nexa Wallet Connect QA lab. No transfer is authorized.','',
 'URI: https://'+domain+'/','Version: 1','Chain ID: 137',
 'Nonce: '+nonce,'Issued At: '+issued,'Expiration Time: '+expiry,
].join('\n');
const data={challengeId:'12345678-1234-4123-8123-123456789012',
 chainId:137,message,expiresAt:expiry};
const options={walletAddress:address,market:'GLOBAL',brDomain:domain,
 globalDomain:domain,purpose:'login',now:Date.parse('2026-10-23T23:04:00.000Z')};
function fakeProvider(opts={}){
 const requests=[];
 let accounts=[address],chain=opts.chain||'0x89';
 const request=async({method})=>{
   requests.push(method);
   if(method==='eth_accounts'||method==='eth_requestAccounts')return accounts;
   if(method==='eth_chainId')return chain;
   if(method==='wallet_switchEthereumChain'){
     if(opts.noSwitch)return null;
     chain='0x89';return null;
   }
   if(method==='personal_sign'){
     if(opts.changeAfterSign)accounts=['0x'+'3'.repeat(40)];
     if(opts.changeChainAfterSign)chain='0x1';
     return '0x'+'a'.repeat(130);
   }
   throw Error('Unexpected wallet RPC: '+method);
 };
 return {provider:{request},requests};
}
{
 const t=fakeProvider();
 assert.equal(await activeAccount(t.provider,{requestConnection:true}),address);
 assert.equal(await requirePolygon(t.provider),137);
 assert.equal(await signCanonicalQaChallenge(t.provider,data,options),'0x'+'a'.repeat(130));
 assert.ok(t.requests.includes('personal_sign'));
 assert.ok(!t.requests.some(m=>/sendTransaction|sendCalls|signTypedData|wallet_grantPermissions/i.test(m)));
}
{
 const t=fakeProvider({chain:'0x1'});
 await requirePolygon(t.provider);
 assert.ok(t.requests.includes('wallet_switchEthereumChain'));
}
{
 const t=fakeProvider({chain:'0x1',noSwitch:true});
 await assert.rejects(requirePolygon(t.provider),/Rede inválida/);
}
{
 const t=fakeProvider({changeAfterSign:true});
 await assert.rejects(signCanonicalQaChallenge(t.provider,data,options),/conta ativa/);
}
{
 const t=fakeProvider({changeChainAfterSign:true});
 await assert.rejects(signCanonicalQaChallenge(t.provider,data,options),/rede foi alterada/);
}
{
 const t=fakeProvider();
 await assert.rejects(signCanonicalQaChallenge(t.provider,{
   ...data,message:message.replace('No transfer is authorized.',
      'Approve unlimited USDC spending now.'),
 },options),/INVALID_WALLET_CHALLENGE/);
 assert.equal(t.requests.length,0,'must not query wallet for malicious challenge');
}
console.log('NEXA_WALLET_CONNECT_INJECTED_QA_TEST PASS');
