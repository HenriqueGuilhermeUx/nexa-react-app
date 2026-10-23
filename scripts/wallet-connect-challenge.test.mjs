import assert from 'node:assert/strict';
import {verifyNexaWalletChallenge} from '../src/walletConnectChallenge.mjs';
const now=Date.parse('2026-10-23T20:00:00.000Z');
const issued='2026-10-23T19:59:00.000Z',expiry='2026-10-23T20:04:00.000Z';
const domain='wallet-lab.example.test',address='0x2222222222222222222222222222222222222222';
const nonce='a'.repeat(64);
const message=[
 domain+' wants you to sign in with your Ethereum account:',address,'',
 'Link this external wallet to your Nexa account. No transfer is authorized.','',
 'URI: https://'+domain+'/','Version: 1','Chain ID: 137',
 'Nonce: '+nonce,'Issued At: '+issued,'Expiration Time: '+expiry,
].join('\n');
const valid={challengeId:'12345678-1234-4123-8123-123456789012',
 chainId:137,expiresAt:expiry,message};
const opts={walletAddress:address,market:'BR',brDomain:domain,
 globalDomain:'global-lab.example.test',now};
assert.equal(verifyNexaWalletChallenge(valid,opts),message);
const bad=[
 [{...valid,chainId:1},opts],
 [{...valid,expiresAt:'2026-10-23T20:05:00.000Z'},opts],
 [{...valid,message:message.replace('No transfer is authorized.','Transfer USDC now.')},opts],
 [{...valid,message:message.replace(domain+' wants','fraud.example wants')},opts],
 [{...valid,message:message.replace('URI: https://'+domain+'/',
   'URI: https://fraud.example/')},opts],
 [{...valid,message:message.replace('Chain ID: 137','Chain ID: 1')},opts],
 [{...valid,message:message.replace('Nonce: '+nonce,'Nonce: ' + 'z'.repeat(64))},opts],
 [{...valid,message:message.replace(address,'0x'+'3'.repeat(40))},opts],
 [valid,{...opts,market:'GLOBAL'}],
 [valid,{...opts,brDomain:'fraud.example'}],
 [valid,{...opts,brDomain:''}],
 [valid,{...opts,now:now+5*60_000}],
 [valid,{...opts,now:now-12*60_000}],
];
for(const [data,options] of bad)
 assert.throws(()=>verifyNexaWalletChallenge(data,options));
console.log('NEXA_WALLET_CONNECT_CANONICAL_CHALLENGE_TEST PASS');
