import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMayaAgenticsBenefits,MAYA_BENEFITS_DISCOVERY_ENABLED} from '../src/mayaAgenticsBenefitsContract.js';
const app=readFileSync('src/App.jsx','utf8');
const presentation=readFileSync('src/MayaAgenticsPlanningBenefit.jsx','utf8');
const existing=readFileSync('src/NexaPremiumAgentics.jsx','utf8');
assert.match(app,/import MayaAgenticsPlanningBenefit/);
assert.match(app,/<MayaAgenticsPlanningBenefit accessToken=\{session\?\.accessToken\}/);
assert.match(app,/import NexaPremiumAgentics/);
assert.match(app,/consultantOpen && <NexaPremiumAgentics/);
assert.match(presentation,/Maya para todos/);
assert.match(presentation,/Maya \+ Agentics Premium/);
assert.match(presentation,/em homologação/i);
assert.match(presentation,/disabled aria-disabled="true"/);
assert.match(presentation,/ainda não está disponível para contas reais/);
assert.match(presentation,/MAYA_BENEFITS_DISCOVERY_ENABLED/);
assert.match(presentation,/fetch\(api \+ '\/maya\/agentics\/benefits'/);
assert.match(presentation,/endpoint\.protocol !== 'https:'/);
assert.match(presentation,/credentials:'omit'/);
assert.match(presentation,/cache:'no-store'/);
assert.match(presentation,/controller\.abort\(\)/);
for(const pattern of [
 /localStorage/,/sessionStorage/,/getAccessToken/,
 /eth_sendTransaction/,/wallet\.send/,/\/payment\//,/\/transfer\//,
 /onClick=/,/POST/,/PUT/,/PATCH/,/DELETE/
])assert.doesNotMatch(presentation,pattern,'Planning benefit panel must not execute actions');
assert.equal(MAYA_BENEFITS_DISCOVERY_ENABLED,false);
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const sample={contract:'nexa-maya-agentics-benefits-v1',actorUserId:alice,
 mayaGeneralAccess:true,mayaAgenticsPremiumBenefit:true,premiumActive:true,
 agenticsPilotStatus:'under_homologation',previewAvailable:false,
 externalEffects:false,financialExecution:false,reviewRequired:true};
assert.deepEqual(parseMayaAgenticsBenefits(sample,alice),{premiumActive:true,previewAvailable:false,verified:true});
assert.equal(parseMayaAgenticsBenefits({...sample,premiumActive:false},alice).premiumActive,false);
for(const forged of [
 {...sample,actorUserId:bob},
 {...sample,premiumActive:'true'},
 {...sample,previewAvailable:true},
 {...sample,financialExecution:true},
 {...sample,externalEffects:true},
 {...sample,agenticsPilotStatus:'released'},
 {...sample,reviewRequired:false},
 null
])assert.equal(parseMayaAgenticsBenefits(forged,alice),null);
assert.equal(parseMayaAgenticsBenefits(sample,bob),null);
assert.match(existing,/consultant-review\/my-finances/);
assert.match(existing,/changeConsent/);
console.log('PASS_MAYA_BENEFITS_IDENTITY_BOUND_READONLY_DISABLED_BY_DEFAULT');
console.log('PASS_EXISTING_PREMIUM_FINANCIAL_CONSULTANT_PRESERVED');
