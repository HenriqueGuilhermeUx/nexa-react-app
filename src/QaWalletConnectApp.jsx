import {useMemo,useState} from 'react';
import {useConnectWallet,usePrivy,useWallets} from '@privy-io/react-auth';
import ExternalWalletConnect from './ExternalWalletConnect.jsx';
import {verifyNexaWalletChallenge} from './walletConnectChallenge.mjs';

const API=String(import.meta.env.VITE_WALLET_CONNECT_LAB_API_URL||'').replace(/\/$/,'');
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
function external(wallets){
 return wallets.filter(w=>ADDRESS.test(String(w?.address||''))&&
  w.walletClientType!=='privy'&&w.walletClientType!=='embedded'&&
  w.connectorType!=='embedded'&&w.connectorType!=='privy');
}
function hexMessage(value){return '0x'+Array.from(new TextEncoder().encode(value))
 .map(n=>n.toString(16).padStart(2,'0')).join('');}
async function qaApi(path,data){
 if(import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED!=='true'||
    !API.startsWith('https://')||API.includes('nexa-backend-p2u0.onrender.com'))
   throw Error('Homologação Wallet Connect indisponível.');
 const r=await fetch(API+path,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
  headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 let reply;try{reply=await r.json()}catch{throw Error('Resposta inválida do servidor QA.')}
 if(!r.ok)throw Error(typeof reply?.message==='string'?reply.message:'Serviço QA indisponível.');
 return reply;
}
export default function QaWalletConnectApp(){
 const {ready,authenticated,user,login,logout}=usePrivy();
 const {wallets,ready:walletReady}=useWallets();
 const {connectWallet}=useConnectWallet();
 const [market,setMarket]=useState('BR');
 const [selected,setSelected]=useState('');
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const candidates=useMemo(()=>external(wallets),[wallets]);
 const email=String(user?.email?.address||'').trim().toLowerCase();
 const wallet=candidates.find(x=>x.address.toLowerCase()===selected.toLowerCase());
 async function authenticate(){
  setBusy(true);setError('');setMessage('');
  try{
   if(!authenticated)throw Error('Entre na aplicação Privy de testes antes de vincular.');
   if(!wallet)throw Error('Selecione uma carteira externa para entrar no laboratório.');
   const provider=typeof wallet.getEthereumProvider==='function'
    ?await wallet.getEthereumProvider()
    :typeof wallet.getProvider==='function'?await wallet.getProvider():null;
   if(!provider?.request)throw Error('Esta carteira não disponibilizou assinatura pessoal.');
   const accounts=await provider.request({method:'eth_accounts'});
   if(!Array.isArray(accounts)||!accounts.some(x=>String(x).toLowerCase()===wallet.address.toLowerCase()))
    throw Error('Endereço ativo diferente do selecionado.');
   const chain=String(await provider.request({method:'eth_chainId'})).toLowerCase();
   if(chain!=='0x89'&&chain!=='137'){
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x89'}]});
    const after=String(await provider.request({method:'eth_chainId'})).toLowerCase();
    if(after!=='0x89'&&after!=='137')throw Error('Selecione a rede Polygon antes de continuar.');
   }
   const challenge=await qaApi('/wallet-connect-inbound/qa/auth/challenge',
    {walletAddress:wallet.address,market});
   const phrase=verifyNexaWalletChallenge(challenge,{walletAddress:wallet.address,
    market,brDomain:import.meta.env.VITE_WALLET_CONNECT_BR_TRUSTED_DOMAIN,
    globalDomain:import.meta.env.VITE_WALLET_CONNECT_GLOBAL_TRUSTED_DOMAIN,
    purpose:'login'});
   const signature=await provider.request({method:'personal_sign',
    params:[hexMessage(phrase),wallet.address]});
   if(!/^0x[0-9a-fA-F]{130}$/.test(String(signature||'')))
    throw Error('A carteira não confirmou uma assinatura válida.');
   const result=await qaApi('/wallet-connect-inbound/qa/auth/verify',
    {challengeId:challenge.challengeId,signature});
   if(result?.mode!=='ISOLATED_QA_TEST_WALLET'||!result.accessToken||
      result.financialExecutionAllowed!==false)
    throw Error('A sessão não foi confirmada como laboratório isolado.');
   setToken(result.accessToken);
   setMessage('Sessão de homologação confirmada. Agora você pode vincular e desvincular carteiras.');
  }catch(e){setError(e?.message||'Não foi possível entrar no laboratório.');}
  finally{setBusy(false)}
 }
 function exit(){
  setToken('');setMessage('Sessão encerrada. Nenhum ativo foi movimentado.');
 }
 return <div className="portal-page">
  <header className="topbar"><div className="brand"><span className="brand-wordmark">NEX<span>A</span></span>
   <small>WALLET CONNECT · QA</small></div>
   <button className="secondary-button" onClick={exit}>Encerrar sessão QA</button></header>
  <main className="portal-content">
   <section className="hero-card">
    <div><span className="external-wallet-pill">Ambiente de homologação isolado</span>
     <h1>Conecte sua carteira à Nexa</h1>
     <p>Teste MetaMask, Rabby, Coinbase Wallet e carteiras externas compatíveis.
       Assinar uma mensagem comprova o controle do endereço; não movimenta USDC nem vincula uma conta financeira de produção.</p>
    </div>
    <div className="wallet-summary"><span>Rede</span><strong>Polygon</strong>
      <small>USDC nativo · taxa Nexa na entrada: 0%</small></div>
   </section>
   <section className="content-card external-wallet-lab">
    <h2>1. Entrar no laboratório</h2>
    <p className="muted">Esta é uma identidade temporária de testes, não seu login financeiro Nexa.</p>
    <label className="external-wallet-field">Mercado de teste
     <select value={market} disabled={busy||Boolean(token)} onChange={e=>setMarket(e.target.value)}>
      <option value="BR">Nexa Brasil</option><option value="GLOBAL">Nexa Global</option>
     </select>
    </label>
    <div className="external-wallet-actions">
     <button type="button" className="secondary-button" disabled={!ready||busy}
       onClick={()=>login()}>{authenticated?'Privy conectado':'Entrar com Privy QA'}</button>
     <button type="button" className="secondary-button"
       disabled={!authenticated||busy||!walletReady} onClick={()=>connectWallet()}>
       Escolher carteira externa
     </button>
    </div>
    {candidates.length>0&&<label className="external-wallet-field">Carteira de autenticação
      <select value={selected} disabled={busy||Boolean(token)} onChange={e=>setSelected(e.target.value)}>
        <option value="">Selecione o endereço</option>
        {candidates.map(w=><option key={w.address} value={w.address}>
          {w.walletClientType||'Carteira externa'} · {w.address.slice(0,8)}…{w.address.slice(-6)}
        </option>)}
      </select>
    </label>}
    {!token&&<button type="button" className="primary-button" disabled={!wallet||busy||!authenticated}
      onClick={authenticate}>{busy?'Conferindo assinatura…':'Assinar e entrar no QA'}</button>}
    {email&&<p className="muted">Conta Privy: {email}</p>}
    {error&&<p role="alert" className="notice notice-warning">{error}</p>}
    {message&&<p role="status" className="notice notice-info">{message}</p>}
   </section>
   {token&&<ExternalWalletConnect accessToken={token} nexaEmail={email}
     qaIdentityVerified={true}/>}
   <section className="content-card" style={{marginTop:18}}>
    <h2>Garantias do teste</h2>
    <p className="muted">Somente assinatura pessoal, criação e remoção de vínculo de endereços na base QA Neon.
      Sem Pix, swaps, aprovação de tokens, movimentação on-chain, crédito no ledger ou acesso a clientes existentes.</p>
   </section>
  </main>
 </div>;
}
