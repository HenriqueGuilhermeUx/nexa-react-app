const ADDR=/^0x[0-9a-fA-F]{40}$/;
const NONCE=/^[0-9a-f]{64}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
/**
 * Validate a server-issued Nexa-only sign-in challenge before asking a wallet
 * for an EIP-191 personal signature. Prevent arbitrary-message phishing.
 * The server must still verify/replay-protect and bind the actual signer.
 */
export function verifyNexaWalletChallenge(input,{walletAddress,market,brDomain,globalDomain,purpose='link',now=Date.now()}){
  const domain=market==='BR'?brDomain:market==='GLOBAL'?globalDomain:'';
  if(!domain||!ADDR.test(walletAddress||'')||!Number.isFinite(now)||
     !/^[a-z0-9.-]+$/i.test(domain)||domain.startsWith('.')||
     domain.endsWith('.')||domain.includes('..'))throw Error('TRUSTED_WALLET_ORIGIN_NOT_CONFIGURED');
  if(!input||!/^\w{8}-[\da-f-]{27,}$/i.test(input.challengeId||'')||
     input.chainId!==137||!ISO.test(input.expiresAt||'')||
     typeof input.message!=='string'||input.message.length>4000)
    throw Error('INVALID_WALLET_CHALLENGE');
  if(purpose!=='login'&&purpose!=='link')throw Error('UNKNOWN_WALLET_CHALLENGE_PURPOSE');
  const action=purpose==='login'
    ?'Sign in to the Nexa Wallet Connect QA lab. No transfer is authorized.'
    :'Link this external wallet to your Nexa account. No transfer is authorized.';
  const lines=input.message.split('\n');
  if(lines.length!==11||!lines[0].endsWith(' wants you to sign in with your Ethereum account:')||
     !ADDR.test(lines[1])||lines[1].toLowerCase()!==walletAddress.toLowerCase()||
     lines[2]!==''||lines[3]!==action||
     lines[4]!==''||lines[5]!=='URI: https://'+domain+'/'||
     lines[6]!=='Version: 1'||lines[7]!=='Chain ID: 137')
    throw Error('INVALID_WALLET_CHALLENGE');
  if(lines[0]!==domain+' wants you to sign in with your Ethereum account:')
    throw Error('WALLET_CHALLENGE_DOMAIN_MISMATCH');
  const nonce=lines[8].replace('Nonce: ','');
  const issued=lines[9].replace('Issued At: ','');
  const expiry=lines[10].replace('Expiration Time: ','');
  if(lines[8]!=='Nonce: '+nonce||!NONCE.test(nonce)||
     lines[9]!=='Issued At: '+issued||!ISO.test(issued)||
     lines[10]!=='Expiration Time: '+expiry||!ISO.test(expiry)||
     expiry!==input.expiresAt)
    throw Error('INVALID_WALLET_CHALLENGE');
  const issuedMs=Date.parse(issued),expiryMs=Date.parse(expiry);
  if(!Number.isFinite(issuedMs)||!Number.isFinite(expiryMs)||
     issuedMs>now+30_000||expiryMs<=now||expiryMs-issuedMs>300_000||
     expiryMs-issuedMs<=0||issuedMs<now-300_000)
    throw Error('EXPIRED_OR_UNTRUSTED_WALLET_CHALLENGE');
  return input.message;
}
