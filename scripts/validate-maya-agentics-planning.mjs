import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('src/App.jsx','utf8');
const presentation=readFileSync('src/MayaAgenticsPlanningBenefit.jsx','utf8');
const existing=readFileSync('src/NexaPremiumAgentics.jsx','utf8');
assert.match(app,/import MayaAgenticsPlanningBenefit/);
assert.match(app,/<MayaAgenticsPlanningBenefit \/>/);
assert.match(app,/import NexaPremiumAgentics/);
assert.match(app,/consultantOpen && <NexaPremiumAgentics/);
assert.match(presentation,/Maya para todos/);
assert.match(presentation,/Maya \+ Agentics Premium/);
assert.match(presentation,/em homologação/i);
assert.match(presentation,/disabled aria-disabled="true"/);
assert.match(presentation,/ainda não está disponível para contas reais/);
for(const pattern of [
 /\bfetch\s*\(/,/localStorage/,/sessionStorage/,/getAccessToken/,
 /Authorization:/,/eth_sendTransaction/,/wallet\.send/,/\/payment\//,/\/transfer\//,
 /onClick=/,/useEffect\(/,/useState\(/
])assert.doesNotMatch(presentation,pattern,'Planning education must not become executable');
assert.match(existing,/consultant-review\/my-finances/);
assert.match(existing,/changeConsent/);
console.log('PASS_MAYA_AGENTICS_PREMIUM_PLANNING_DISCOVERY_NONEXECUTABLE');
console.log('PASS_EXISTING_PREMIUM_FINANCIAL_CONSULTANT_PRESERVED');
