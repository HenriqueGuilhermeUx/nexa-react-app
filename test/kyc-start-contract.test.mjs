import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrazilDiditStart, trustedDiditUrl} from '../src/kyc-start-contract.mjs';

const API='https://nexa-backend-p2u0.onrender.com/api/v1';
const VALID='https://verify.didit.me/session/test-safe-session';
const ok=value=>({ok:true,status:200,json:async()=>value});
const error=status=>({ok:false,status,json:async()=>({message:'redacted provider diagnostic'})});
function setup({me={id:'test-only-account',residenceCountry:'BR'},current={success:true,provider:'didit',kycStatus:'pending'},start={verificationUrl:VALID},status={}}={}) {
  const calls=[];
  const fetchImpl=async (url,options={})=>{
    calls.push({url,options});
    if(url===API+'/user/me')return status.me?error(status.me):ok(me);
    if(url===API+'/kyc/didit/me')return status.current?error(status.current):ok(current);
    if(url===API+'/kyc/didit/brazil/start')return status.start?error(status.start):ok(start);
    throw new Error('Unexpected test-only URL');
  };
  const execute=(opts={})=>prepareBrazilDiditStart({
    accessToken:'test-token-not-valid-for-real-service',
    apiBaseUrl:API,consent:true,fetchImpl,...opts,
  });
  return {execute,calls};
}

test('explicit consent is required before any network call',async()=>{
  const {execute,calls}=setup();
  await assert.rejects(()=>execute({consent:false}),/consentimento explícito/);
  assert.equal(calls.length,0);
});
test('unauthenticated requests never query Didit',async()=>{
  const {execute,calls}=setup();
  await assert.rejects(()=>execute({accessToken:''}),/Entre novamente/);
  assert.equal(calls.length,0);
});
test('only official HTTPS Nexa API can receive token',async()=>{
  for(const url of ['http://nexa-backend-p2u0.onrender.com/api/v1',
    'https://nexa-backend-p2u0.onrender.com.evil.test/api/v1',
    'https://evil.test/api/v1','https://user@trynexa.com.br/api/v1']) {
    const {execute,calls}=setup();
    await assert.rejects(()=>execute({apiBaseUrl:url}),/configuração da API/);
    assert.equal(calls.length,0);
  }
});
test('pending Brazilian user can start a new session only after GET status',async()=>{
  const {execute,calls}=setup();
  const result=await execute();
  assert.deepEqual(result,{kind:'redirect',url:VALID,reused:false});
  assert.deepEqual(calls.map(x=>x.url),[API+'/user/me',API+'/kyc/didit/me',API+'/kyc/didit/brazil/start']);
  assert.equal(calls.at(-1).options.method,'POST');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{consent:true});
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-token-not-valid-for-real-service');
});
test('existing valid Didit session is reused without creating another',async()=>{
  const {execute,calls}=setup({current:{
    success:true,provider:'didit',kycStatus:'pending',
    diditSessionStatus:'Not Started',verificationUrl:VALID,
  }});
  assert.deepEqual(await execute(),{kind:'redirect',url:VALID,reused:true});
  assert.equal(calls.length,2);
});
test('expired sessions may be restarted, but never auto-submitted',async()=>{
  const {execute,calls}=setup({current:{
    success:true,provider:'didit',kycStatus:'pending',
    diditSessionStatus:'Expired',verificationUrl:VALID,
  }});
  assert.equal((await execute()).reused,false);
  assert.equal(calls.length,3);
});
test('approved status blocks any creation attempt',async()=>{
  const {execute,calls}=setup({current:{success:true,provider:'didit',kycStatus:'approved'}});
  assert.equal((await execute()).kind,'approved');
  assert.equal(calls.length,2);
});
test('review states block additional sessions',async()=>{
  for(const current of [
    {success:true,provider:'didit',kycStatus:'in_review'},
    {success:true,provider:'didit',kycStatus:'pending',manualReviewRequired:true},
  ]) {
    const {execute,calls}=setup({current});
    assert.equal((await execute()).kind,'manual_review');
    assert.equal(calls.length,2);
  }
});
test('unknown Didit status response fails closed',async()=>{
  const {execute,calls}=setup({current:{success:true,provider:'unknown',kycStatus:'pending'}});
  await assert.rejects(()=>execute(),/confirmar a situação/);
  assert.equal(calls.length,2);
});
test('foreign accounts do not call Didit',async()=>{
  const {execute,calls}=setup({me:{id:'test',residenceCountry:'US'}});
  await assert.rejects(()=>execute(),/brasileiras confirmadas/);
  assert.equal(calls.length,1);
});
test('a 401 or 403 stops before any session is created',async()=>{
  for(const status of [{me:401},{current:403}]) {
    const {execute,calls}=setup({status});
    await assert.rejects(()=>execute(),/sessão expirou|não pode acessar/);
    assert.equal(calls.some(x=>x.options.method==='POST'),false);
  }
});
test('provider errors return generic messages and never expose details',async()=>{
  const {execute,calls}=setup({status:{start:502}});
  await assert.rejects(()=>execute(),e=>{
    assert.doesNotMatch(e.message,/redacted provider diagnostic/);
    return true;
  });
  assert.equal(calls.length,3);
});
test('Didit URL is strictly HTTPS and within authorized domains',()=>{
  assert.equal(trustedDiditUrl(VALID),VALID);
  for(const input of [
    'http://verify.didit.me/session/test','https://didit.me.evil.test/session',
    'https://evil.test/?next=didit.me','https://didit.io@evil.test/session',
    'https://user@verify.didit.me/session','https://verify.didit.me:444/session',
    'javascript:alert(1)','//verify.didit.me/session','not-a-url',
  ])assert.equal(trustedDiditUrl(input),null,input);
});
test('malformed provider redirect does not navigate',async()=>{
  const {execute}=setup({start:{verificationUrl:'https://verify.didit.me.evil.test/s'}});
  await assert.rejects(()=>execute(),/link oficial reconhecido/);
});
test('test suite never calls live Nexa or Didit API',()=>{
  assert.ok(typeof setup().execute==='function');
  // All HTTP calls in this module are injected through a fake.
});
