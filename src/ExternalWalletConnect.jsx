import {useEffect, useMemo, useState} from 'react';
import {useConnectWallet, usePrivy, useWallets} from '@privy-io/react-auth';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const CHALLENGE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const API=String(import.meta.env.VITE_WALLET_CONNECT_LAB_API_URL || '').replace(/\/$/,'');
const LAB_ENABLED=import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED==='true';
const PRODUCTION_API='https://nexa-backend-p2u0.onrender.com/api/v1';

function assertLabApi(){
  let url;
  try { url=new URL(API); } catch {throw Error('Configure uma API de homologação Wallet Connect.');}
  if(!LAB_ENABLED||url.protocol!=='https:'||url.username||url.password||url.hash||
     url.search||url.pathname!=='/api/v1'||url.origin+url.pathname===PRODUCTION_API||
     url.hostname==='nexa-backend-p2u0.onrender.com'){
    throw Error('A API de homologação não está configurada com segurança.');
  }
  return API;
}
function getUserEmail(user){
  const e=user?.email?.address||user?.linkedAccounts?.find(x=>x?.type==='email')?.address;
  return String(e||'').trim().toLowerCase();
}
function short(x){return x?String(x).slice(0,8)+'…'+String(x).slice(-6):'—';}
function hexMessage(s){
  return '0x'+Array.from(new TextEncoder().encode(s))
    .map(n=>n.toString(16).padStart(2,'0')).join('');
}
function externalWallets(wallets){
  return wallets.filter(w=>ADDRESS.test(String(w?.address||''))&&
    w.walletClientType!=='privy'&&w.walletClientType!=='embedded'&&
    w.connectorType!=='embedded'&&w.connectorType!=='privy');
}
async function labApi(path,token,options={}){
  const base=assertLabApi();
  if(!token||!/^\/wallet-connect-inbound\/ownership\/(challenge|verify|links|link)$/.test(path))
    throw Error('Acesso não autorizado ao laboratório.');
  const res=await fetch(base+path,{
    ...options,credentials:'omit',cache:'no-store',redirect:'error',
    headers:{'Authorization':'Bearer '+token,
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...options.headers},
  });
  let data;
  try{data=await res.json();}catch{throw Error('Resposta inválida da API Wallet Connect.');}
  if(!res.ok)throw Error(typeof data?.message==='string'?data.message:'Serviço Wallet Connect indisponível.');
  return data;
}

/**
 * Isolated QA connector. The Privy modal offers installed and supported
 * external wallets (including WalletConnect where enabled in Privy).
 * Linking uses one-time server-issued challenges; no transaction broadcast.
 */
export default function ExternalWalletConnect({accessToken,nexaEmail}){
  const {ready,authenticated,user,login}=usePrivy();
  const {wallets,ready:walletsReady}=useWallets();
  const {connectWallet}=useConnectWallet();
  const [market,setMarket]=useState('BR');
  const [selected,setSelected]=useState('');
  const [links,setLinks]=useState([]);
  const [state,setState]=useState('idle');
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const candidates=useMemo(()=>externalWallets(wallets),[wallets]);
  const emailMatch=Boolean(authenticated&&getUserEmail(user)&&nexaEmail&&
    getUserEmail(user)===String(nexaEmail).toLowerCase());
  const current=candidates.find(w=>w.address.toLowerCase()===selected.toLowerCase())||null;

  useEffect(()=>{
    if(!candidates.some(w=>w.address.toLowerCase()===selected.toLowerCase())){
      setSelected(candidates.length===1?candidates[0].address:'');
    }
  },[walletsReady,candidates,selected]);
  useEffect(()=>{
    if(!emailMatch||!accessToken||!LAB_ENABLED)return;
    let active=true;
    labApi('/wallet-connect-inbound/ownership/links',accessToken)
      .then(data=>{if(active)setLinks(Array.isArray(data?.wallets)?data.wallets:[]);})
      .catch(()=>{if(active)setLinks([]);});
    return ()=>{active=false;};
  },[accessToken,emailMatch]);

  if(!LAB_ENABLED)return null;

  async function connect(){
    setError('');setInfo('');setState('connecting');
    try{
      if(!ready)throw Error('A autenticação Privy ainda está carregando.');
      if(!authenticated){login();setInfo('Confirme o mesmo e-mail da sua conta Nexa antes de continuar.');return;}
      if(!emailMatch)throw Error('O e-mail Privy é diferente do e-mail da sua conta Nexa.');
      connectWallet();
      setInfo('Escolha sua carteira no Privy. Ao conectar, selecione o endereço para comprovar o vínculo.');
    }catch(e){setError(e.message||'Não foi possível abrir a carteira.');}
    finally{setState('idle');}
  }

  async function link(){
    setError('');setInfo('');setState('signing');
    try{
      assertLabApi();
      if(!emailMatch)throw Error('Valide o mesmo e-mail Nexa no Privy antes de assinar.');
      if(!current||!ADDRESS.test(current.address))throw Error('Escolha uma carteira externa válida.');
      const provider=typeof current.getEthereumProvider==='function'
        ?await current.getEthereumProvider()
        :typeof current.getProvider==='function'?await current.getProvider():null;
      if(!provider||typeof provider.request!=='function')throw Error('Carteira externa sem provedor de assinatura.');
      const accounts=await provider.request({method:'eth_accounts'});
      if(!Array.isArray(accounts)||!accounts.some(x=>String(x).toLowerCase()===current.address.toLowerCase()))
        throw Error('A carteira ativa não corresponde ao endereço selecionado.');
      const chain=String(await provider.request({method:'eth_chainId'})).toLowerCase();
      if(chain!=='0x89'&&chain!=='137'){
        await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x89'}]});
        const after=String(await provider.request({method:'eth_chainId'})).toLowerCase();
        if(after!=='0x89'&&after!=='137')throw Error('Selecione a rede Polygon.');
      }
      const challenge=await labApi('/wallet-connect-inbound/ownership/challenge',accessToken,{
        method:'POST',body:JSON.stringify({walletAddress:current.address,market}),
      });
      if(!CHALLENGE.test(challenge?.challengeId||'')||
         typeof challenge?.message!=='string'||challenge.message.length<30||
         challenge.message.length>4000||challenge.chainId!==137||
         !Number.isFinite(Date.parse(challenge.expiresAt))||
         Date.parse(challenge.expiresAt)<=Date.now()){
        throw Error('Desafio da Nexa inválido ou expirado. Nenhuma assinatura realizada.');
      }
      const signature=await provider.request({method:'personal_sign',
        params:[hexMessage(challenge.message),current.address]});
      if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))
        throw Error('A carteira não devolveu uma assinatura EOA válida.');
      const verified=await labApi('/wallet-connect-inbound/ownership/verify',accessToken,{
        method:'POST',body:JSON.stringify({challengeId:challenge.challengeId,signature,market}),
      });
      if(verified?.bound!==true||
         String(verified.address||'').toLowerCase()!==current.address.toLowerCase())
        throw Error('O vínculo não foi confirmado pelo servidor.');
      const result=await labApi('/wallet-connect-inbound/ownership/links',accessToken);
      setLinks(Array.isArray(result?.wallets)?result.wallets:[]);
      setInfo('Carteira vinculada ao seu usuário Nexa no laboratório. Nenhum saldo foi transferido.');
    }catch(e){setError(e.message||'Não foi possível comprovar esta carteira.');}
    finally{setState('idle');}
  }

  async function unlink(address){
    setError('');setInfo('');setState('unlinking');
    try{
      if(!emailMatch||!ADDRESS.test(address))throw Error('Carteira ou sessão inválida.');
      const result=await labApi('/wallet-connect-inbound/ownership/link',accessToken,{
        method:'DELETE',body:JSON.stringify({walletAddress:address}),
      });
      if(result?.revoked!==true)throw Error('A API não confirmou a desvinculação.');
      setLinks(prev=>prev.filter(w=>String(w.address).toLowerCase()!==address.toLowerCase()));
      setInfo('Vínculo removido. Não houve movimentação de fundos.');
    }catch(e){setError(e.message||'Não foi possível desvincular a carteira.');}
    finally{setState('idle');}
  }

  return <section className="content-card external-wallet-lab" aria-label="Wallet Connect homologação">
    <div className="external-wallet-heading">
      <div>
        <small>HOMOLOGAÇÃO ISOLADA · BRASIL E GLOBAL</small>
        <h2>Conectar carteira externa</h2>
        <p className="muted">MetaMask, Rabby, Coinbase Wallet, Trust Wallet e outras opções oferecidas pelo Privy. A Nexa não solicita sua chave privada.</p>
      </div>
      <span className="external-wallet-pill">0% taxa Nexa na entrada</span>
    </div>
    <p className="muted">Esta etapa comprova propriedade da carteira; não transfere nem credita USDC. Polygon · USDC nativo.</p>
    <label className="external-wallet-field">Mercado
      <select value={market} disabled={state!=='idle'} onChange={e=>setMarket(e.target.value)}>
        <option value="BR">Nexa Brasil</option>
        <option value="GLOBAL">Nexa Global</option>
      </select>
    </label>
    {!ready?<p className="muted">Carregando Privy…</p>:
      !authenticated?<p className="notice notice-info">Entre na sua conta Privy usando o mesmo e-mail da Nexa.</p>:
      !emailMatch?<p className="notice notice-warning">E-mail Privy diferente da conta Nexa. Nenhum vínculo será autorizado.</p>:null}
    <div className="external-wallet-actions">
      <button className="secondary-button" type="button" onClick={connect}
        disabled={state!=='idle'||!ready}>
        {authenticated?'Escolher carteira':'Confirmar e-mail Privy'}
      </button>
    </div>
    {candidates.length>0&&<label className="external-wallet-field">Carteira conectada
      <select value={selected} disabled={state!=='idle'} onChange={e=>setSelected(e.target.value)}>
        <option value="">Selecione uma carteira</option>
        {candidates.map((w,i)=><option key={w.address+'-'+i} value={w.address}>
          {w.walletClientType||'Carteira externa'} · {short(w.address)}
        </option>)}
      </select>
    </label>}
    {current&&<div className="external-wallet-actions">
      <span className="muted">{short(current.address)} · Polygon</span>
      <button className="primary-button" type="button" disabled={state!=='idle'||!emailMatch}
        onClick={link}>{state==='signing'?'Confirmando…':'Assinar e vincular'}</button>
    </div>}
    {links.length>0&&<div className="external-wallet-linked">
      <strong>Carteiras vinculadas nesta conta</strong>
      {links.map((w,i)=><div key={String(w.address)+'-'+i} className="external-wallet-linked-row">
        <span>{short(w.address)} · Polygon</span>
        <button type="button" className="text-button" disabled={state!=='idle'||!emailMatch}
          onClick={()=>unlink(w.address)}>Desvincular</button>
      </div>)}
    </div>}
    {error&&<p role="alert" className="notice notice-warning">{error}</p>}
    {info&&<p role="status" className="notice notice-info">{info}</p>}
  </section>;
}
