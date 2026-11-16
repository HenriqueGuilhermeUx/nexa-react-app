import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const jsx=readFileSync('src/NexaLifecycleCoach.jsx','utf8');
test('Didit offers mobile face capture without sharing session or bypassing consent',()=>{
 assert.match(jsx,/verificação facial preferencialmente no celular/);
 assert.match(jsx,/trynexa\.com\.br\/portal\//);
 assert.match(jsx,/entre na mesma conta Nexa/);
 assert.match(jsx,/Não envie links com sessão/);
 assert.match(jsx,/checked=\{kycConsent\}/);
 assert.match(jsx,/disabled=\{kycBusy \|\| !kycConsent\}/);
 assert.match(jsx,/prepareBrazilDiditStart/);
 assert.match(jsx,/Não é necessário depositar antes do KYC/);
 assert.doesNotMatch(jsx,/window\.location\.assign\(['"]https:\/\/.*token=/);
});
