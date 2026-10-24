import {verifyNexaWalletChallenge} from './walletConnectChallenge.mjs';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const SIGNATURE=/^0x[0-9a-fA-F]{130}$/;
const QA_HOST='nexa-walletconnect-qa-api.onrender.com';
export const QA_API_PATH='/api/v1';

export function requireQaUrl(candidate){
  let url;
  try{url=new URL(String(candidate||''));}catch{throw Error('API de testes inválida.');}
  if(url.protocol!=='https:'||url.hostname!==QA_HOST||url.pathname!==QA_API_PATH||
     url.search||url.hash||url.username||url.password||url.port)
    throw Error('Somente a API de homologação isolada está autorizada.');
  return url.origin+url.pathname;
}
// The authenticated QA identity is independent of the next wallet being
// linked. Swapping selected providers must not silently revoke its session.
export function nextQaConnectionState(session,key,address,now=Date.now()){
  if(typeof key!=='string'||!key||!Number.isFinite(now))
    throw Error('Invalid wallet connection transition.');
  const connected={key,address:verifiedAddress(address)};
  const retainedSession=session&&typeof session.token==='string'&&
    session.expiresAt>now?session:null;
  return {session:retainedSession,connected};
}
export function verifiedAddress(value){
  if(typeof value!=='string'||!ADDRESS.test(value))throw Error('Endereço EVM inválido.');
  return value.toLowerCase();
}
export function walletLabel(raw){
  return typeof raw==='string'?raw.replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,44)||'Carteira externa':'Carteira externa';
}
export async function activeAccount(provider,{requestConnection=false,expectedAddress}={}){
  if(typeof provider?.request!=='function')throw Error('Provedor Ethereum indisponível.');
  const accounts=await provider.request({method:requestConnection?'eth_requestAccounts':'eth_accounts'});
  if(!Array.isArray(accounts)||accounts.length===0)throw Error('Conecte e desbloqueie sua carteira.');
  const current=verifiedAddress(accounts[0]);
  if(expectedAddress&&current!==verifiedAddress(expectedAddress))
    throw Error('A conta ativa na carteira foi alterada.');
  return current;
}
export async function requirePolygon(provider){
  let chain=String(await provider.request({method:'eth_chainId'})).toLowerCase();
  if(chain!=='0x89'&&chain!=='137'){
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x89'}]});
    chain=String(await provider.request({method:'eth_chainId'})).toLowerCase();
  }
  if(chain!=='0x89'&&chain!=='137')throw Error('Rede inválida. Selecione Polygon.');
  return 137;
}
export function challengeOptions({walletAddress,market,domain,now=Date.now(),purpose}){
  return {walletAddress,market,brDomain:domain,globalDomain:domain,purpose,now};
}
export async function signCanonicalQaChallenge(provider,challenge,options){
  // Do not sign arbitrary server messages, even if the API is compromised.
  const content=verifyNexaWalletChallenge(challenge,options);
  await activeAccount(provider,{expectedAddress:options.walletAddress});
  await requirePolygon(provider);
  const hex='0x'+Array.from(new TextEncoder().encode(content))
    .map(n=>n.toString(16).padStart(2,'0')).join('');
  const signature=await provider.request({method:'personal_sign',
    params:[hex,options.walletAddress]});
  if(typeof signature!=='string'||!SIGNATURE.test(signature))
    throw Error('A carteira não retornou assinatura EOA válida.');
  // Account or network may change while wallet popup is visible.
  await activeAccount(provider,{expectedAddress:options.walletAddress});
  const after=String(await provider.request({method:'eth_chainId'})).toLowerCase();
  if(after!=='0x89'&&after!=='137')
    throw Error('A rede foi alterada durante a assinatura.');
  return signature;
}

export async function qaRequest(base,path,{method='GET',token,body,signal}={}){
  const root=requireQaUrl(base);
  const allowed=new Set([
    'qa/auth/challenge','qa/auth/verify','ownership/challenge',
    'ownership/verify','ownership/links','ownership/link'
  ]);
  const clean=String(path||'').replace(/^\/+/,'');
  if(!allowed.has(clean))throw Error('Rota QA não autorizada.');
  if(!/^qa\/auth\//.test(clean)&&!token)throw Error('Sessão QA necessária.');
  const response=await fetch(root+'/wallet-connect-inbound/'+clean,{
    method,cache:'no-store',credentials:'omit',redirect:'error',signal,
    headers:{...(body?{'content-type':'application/json'}:{}),
      ...(token?{authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  let data;try{data=await response.json();}catch{throw Error('Resposta da API QA inválida.');}
  if(!response.ok){
    const error=Error(typeof data?.message==='string'?data.message:'Não foi possível completar a operação QA.');
    error.status=response.status;
    throw error;
  }
  return data;
}
