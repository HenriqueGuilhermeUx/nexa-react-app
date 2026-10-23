import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
const file=readFileSync(new URL('../src/ExternalWalletConnect.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
function needs(s,label){assert.ok(file.includes(s),label)}
needs("useConnectWallet","Privy connect modal");
needs("useWallets","external wallet picker");
needs("walletClientType!=='privy'","embedded wallet isolation");
needs("getUserEmail(user)===String(nexaEmail).toLowerCase()","same-email identity gate");
needs("VITE_WALLET_CONNECT_LAB_ENABLED==='true'","explicit QA flag");
needs("VITE_WALLET_CONNECT_LAB_API_URL","staging URL");
needs("url.hostname==='nexa-backend-p2u0.onrender.com'","reject live backend");
needs("/wallet-connect-inbound/ownership/challenge","server challenge");
needs("/wallet-connect-inbound/ownership/verify","signature verifier");
needs("/wallet-connect-inbound/ownership/links","list ownership");
needs("method:'DELETE'","unlink");
needs("params:[hexMessage(approvedMessage),current.address]","only checked message signature");
needs("verifyNexaWalletChallenge(challenge","canonical EIP-191 challenge validation");
needs("wallet_switchEthereumChain","Polygon guard");
needs("eth_accounts","active wallet ownership check");
needs("chainId!==137","chain check in server challenge");
needs("verified?.bound!==true","server completion gate");
needs("credentials:'omit'","no cross-site cookies");
needs("cache:'no-store'","no cache of challenge");
assert.ok(app.includes("import ExternalWalletConnect from './ExternalWalletConnect.jsx'"));
assert.ok(app.includes("<ExternalWalletConnect"));
assert.ok(style.includes(".external-wallet-lab"));
assert.equal(pkg.dependencies['@privy-io/react-auth'],'3.35.2');
for(const bad of ['eth_sendTransaction','wallet_sendCalls','PRIVY_APP_SECRET',
  'PRIVY_SECRET_KEY','privateKey','seedPhrase','sendTransaction','approve(']){
  assert.ok(!file.includes(bad),'Unapproved action or secret: '+bad);
}

const injected=readFileSync(new URL('../src/QaInjectedWalletApp.jsx',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../src/walletConnectInjected.mjs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
for(const expected of [
 "eip6963:announceProvider","eip6963:requestProvider","eth_requestAccounts",
 "wallet_switchEthereumChain","signCanonicalQaChallenge",
 "qa/auth/challenge","qa/auth/verify","ownership/links",
 "ownership/challenge","ownership/verify","ownership/link",
]){
 assert.ok((injected+adapter).includes(expected),'Missing QA wallet flow: '+expected);
}
assert.ok(main.includes('injectedQa ? ('));
assert.ok(main.includes('<QaInjectedWalletApp />'));
assert.ok(main.indexOf('<QaInjectedWalletApp />')<main.lastIndexOf('<PrivyProvider'));
assert.ok(adapter.includes("QA_HOST='nexa-walletconnect-qa-api.onrender.com'"));
assert.ok(adapter.includes("credentials:'omit'"));
assert.ok(adapter.includes("challengeOptions"));
assert.ok(injected.includes('LABORATÓRIO NÃO FINANCEIRO'));
for(const bad of ['eth_sendTransaction','wallet_sendCalls','sendTransaction',
 'PRIVY_SECRET_KEY','PRIVY_APP_SECRET','seedPhrase','privateKey']){
 assert.ok(!(injected+adapter).includes(bad),'Unsafe QA wallet code: '+bad);
}

console.log('WALLET_CONNECT_ISOLATED_WEB_STATIC_CHECK PASS');
