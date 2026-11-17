/**
 * Customer-signed Aave Polygon native USDC pilot for Nexa web/PWA.
 * No backend wallet key, no autonomous transaction execution. Never use
 * arbitrary calldata returned by an API without reconstructing its exact ABI.
 * Each customer operation and ERC20 approval needs a separate explicit click.
 */
export const AAVE_CHAIN=137;
export const AAVE_USDC='0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
export const AAVE_POOL='0x794a61358d6845594f94dc1db02a252b5b4814ad';
const AMOUNT_MAX=100_000_000n;
const AMOUNT_MIN=1_000_000n;
const TX_HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX=/^0x(?:[0-9a-fA-F]{2})*$/;

function normalizeAddress(value){
  if(typeof value!=='string'||!ADDRESS.test(value))throw Error('Endereço inválido');
  return value.toLowerCase();
}
function wordAddress(address){return normalizeAddress(address).slice(2).padStart(64,'0');}
function wordUint(value){
  const n=BigInt(value);
  if(n<0n||n>(1n<<256n)-1n)throw Error('Quantidade fora de uint256');
  return n.toString(16).padStart(64,'0');
}
function expectedData(kind,amount,owner){
  const token=wordAddress(AAVE_USDC),pool=wordAddress(AAVE_POOL),who=wordAddress(owner),sum=wordUint(amount);
  if(kind==='APPROVAL')return '0x095ea7b3'+pool+sum;
  if(kind==='SUPPLY')return '0x617ba037'+token+sum+who+wordUint(0n);
  if(kind==='WITHDRAW')return '0x69328dec'+token+sum+who;
  throw Error('Aave: método desconhecido');
}
export function parsePilotDecimal(amount){
  if(typeof amount!=='string'||!/^(?:[1-9][0-9]{0,2})(?:\.[0-9]{1,6})?$/.test(amount))
    throw Error('Informe de 1 a 100 USDC, sem casas extras.');
  const [w,f='']=amount.split('.');
  const n=BigInt(w)*1_000_000n+BigInt(f.padEnd(6,'0')||'0');
  if(n<AMOUNT_MIN||n>AMOUNT_MAX)throw Error('O valor do piloto deve estar entre 1 e 100 USDC.');
  return n;
}
export function validateAavePilotQuote(quote,walletAddress){
  if(!quote||quote.success!==true||quote.mode!=='USER_SIGNED_AAVE_PILOT'||
     quote.transactionPrepared!==true||quote.transactionSent!==false||
     quote.executionEnabledOnServer!==false||quote.requiresExplicitWalletConfirmation!==true||
     quote.chainId!==137||!['SUPPLY','WITHDRAW'].includes(quote.action)||
     !/^[1-9][0-9]*$/.test(String(quote.amountBaseUnits||'')))
      throw Error('Aave: operação não autorizada.');
  const owner=normalizeAddress(quote.walletAddress);
  if(normalizeAddress(walletAddress)!==owner)throw Error('Sua carteira Privy não corresponde à carteira autorizada.');
  const amount=BigInt(quote.amountBaseUnits);
  if(amount<AMOUNT_MIN||amount>AMOUNT_MAX)throw Error('Aave: valor fora do limite.');
  const expiry=Date.parse(quote.expiresAt);
  if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry-Date.now()>35_000)
    throw Error('A cotação Aave expirou; revise novamente.');
  const steps=quote.quote?.steps;
  const kinds=quote.action==='WITHDRAW'?['WITHDRAW']:
    steps?.length===2?['APPROVAL','SUPPLY']:['SUPPLY'];
  if(!Array.isArray(steps)||steps.length!==kinds.length)throw Error('Sequência Aave inválida.');
  for(const [i,step] of steps.entries()){
    if(!step||step.kind!==kinds[i]||step.chainId!==137||
       step.requiresExplicitWalletConfirmation!==true||
       normalizeAddress(step.from)!==owner||
       normalizeAddress(step.to)!==(step.kind==='APPROVAL'?AAVE_USDC:AAVE_POOL)||
       step.value!=='0x0'||!HEX.test(step.data)||
       step.data.toLowerCase()!==expectedData(step.kind,amount,owner)){
      throw Error('Destino ou calldata Aave diferente do esperado.');
    }
  }
  return steps;
}

export async function sendAavePilotStep(provider,quote,walletAddress){
  const steps=validateAavePilotQuote(quote,walletAddress);
  const chain=String(await provider.request({method:'eth_chainId'})).toLowerCase();
  if(chain!=='0x89'&&chain!=='137')
    throw Error('Selecione a rede Polygon na carteira antes de confirmar.');
  // Exactly one customer-confirmed call. Further steps require another action.
  const step=steps[0];
  const hash=await provider.request({method:'eth_sendTransaction',
    params:[{from:walletAddress,to:step.to,data:step.data,value:'0x0'}]});
  if(typeof hash!=='string'||!TX_HASH.test(hash))throw Error('Hash de transação inválido.');
  return {hash,step};
}

export async function getAavePilotReceipt(provider,hash,owner,to){
  if(!TX_HASH.test(hash))throw Error('Hash inválido.');
  const data=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});
  if(data==null)return 'pending';
  if(typeof data!=='object'||Array.isArray(data)||
    String(data.transactionHash||'').toLowerCase()!==hash.toLowerCase()||
    normalizeAddress(data.from)!==normalizeAddress(owner)||
    normalizeAddress(data.to)!==normalizeAddress(to)||
    !TX_HASH.test(String(data.blockHash||'')))throw Error('Recibo blockchain não corresponde à operação.');
  if(data.status==='0x1')return 'confirmed';
  if(data.status==='0x0')return 'failed';
  throw Error('Status blockchain inválido.');
}
