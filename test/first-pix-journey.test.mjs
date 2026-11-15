import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component=readFileSync(new URL('../src/NexaFirstPixJourney.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');

test('Pix guidance is rendered only after the Nexa KYC is approved',()=>{
  assert.match(component,/kycStatus\|\|''\)\.toLowerCase\(\)!=='approved'/);
  assert.match(component,/!accessToken\) return null/);
  assert.match(app,/kycStatus=\{user\?\.kycStatus\}/);
  assert.match(app,/NexaFirstPixJourney/);
});
test('telemetry is user-authenticated, optional, and has no payment authority',()=>{
  assert.match(component,/CLIENT_STAGES = new Set\(\['deposit_screen_opened','pix_method_selected'\]\)/);
  assert.match(component,/apiBaseUrl\+'\/deposit-journey\/event'/);
  assert.match(component,/Authorization:'Bearer '\+accessToken/);
  assert.match(component,/eventId:crypto\.randomUUID\(\)/);
  assert.doesNotMatch(component,/woovi-pix|createPixCharge|amountBrl|pix_paid|usdc_delivered/);
  assert.match(component,/Nunca|não gera uma cobrança Pix/);
});
test('no deposit or purchase is implied from merely opening the guide',()=>{
  assert.match(component,/O primeiro depósito é opcional/);
  assert.match(component,/não houve débito/);
  assert.match(component,/Nenhuma compra|nenhuma compra/);
  assert.match(component,/void reportJourneyStage/);
  assert.match(component,/catch \{ \/\* Never block/);
});
