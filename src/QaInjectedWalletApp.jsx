import {useCallback,useEffect,useMemo,useState} from 'react';
import {
  activeAccount,challengeOptions,nextQaConnectionState,qaRequest,requirePolygon,
  requireQaUrl,signCanonicalQaChallenge,verifiedAddress,walletLabel,
} from './walletConnectInjected.mjs';

const BASE=String(import.meta.env.VITE_WALLET_CONNECT_LAB_API_URL||'');
const DOMAIN=String(import.meta.env.VITE_WALLET_CONNECT_BR_TRUSTED_DOMAIN||'');
const QA_ENABLED=import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED==='true'&&
  import.meta.env.VITE_WALLET_CONNECT_QA_INJECTED==='true';
function short(value){return value?value.slice(0,8)+'…'+value.slice(-6):'—';}
function readable(error){
  if(error?.code===4001)return 'Solicitação recusada na carteira. Nenhum vínculo foi criado.';
  return error instanceof Error?error.message:'A solicitação não foi concluída.';
}
export default function QaInjectedWalletApp(){
  const [providers,setProviders]=useState([]);
  const [selectedKey,setSelectedKey]=useState('');
  const [connected,setConnected]=useState(null);
  const [session,setSession]=useState(null);
  const [market,setMarket]=useState('BR');
  const [links,setLinks]=useState([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const chosen=useMemo(()=>providers.find(x=>x.key===selectedKey)||null,[providers,selectedKey]);
  const safe=useMemo(()=>{
    try{requireQaUrl(BASE);return QA_ENABLED&&DOMAIN==='nexa-walletconnect-qa-web.onrender.com';}
    catch{return false;}
  },[]);
  const sessionValid=Boolean(session&&session.expiresAt>Date.now());
  const clearSession=useCallback(()=>{setSession(null);setLinks([]);},[]);
  const clearWallet=useCallback(()=>{
    clearSession();setConnected(null);setNotice('');
  },[clearSession]);
  const rootProvider=useMemo(()=>session?.rootKey
    ?providers.find(x=>x.key===session.rootKey)||null:null,
    [providers,session?.rootKey]);

  useEffect(()=>{
    if(!QA_ENABLED)return;
    function addProvider(provider,info={}){
      if(!provider||typeof provider.request!=='function')return;
      setProviders(previous=>{
        if(previous.some(x=>x.provider===provider))return previous;
        const key=typeof info.uuid==='string'&&/^[\w-]{8,100}$/.test(info.uuid)
          ?info.uuid:'legacy-'+previous.length;
        const label=walletLabel(info.name||'Carteira no navegador');
        return [...previous,{key:key+'-'+previous.length,label,provider}];
      });
    }
    function announce(event){
      const detail=event?.detail;
      if(!detail?.provider||!detail?.info)return;
      addProvider(detail.provider,detail.info);
    }
    window.addEventListener('eip6963:announceProvider',announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    if(window.ethereum){
      const provided=Array.isArray(window.ethereum.providers)
        ?window.ethereum.providers:[window.ethereum];
      provided.forEach((p,i)=>addProvider(p,{name:i===0?'Carteira injetada':'Carteira injetada '+(i+1)}));
    }
    return ()=>window.removeEventListener('eip6963:announceProvider',announce);
  },[]);

  // A QA login remains valid while the user selects and connects another
  // EOA. Changing the logged-in ROOT account is different: it ends the session.
  useEffect(()=>{
    if(!chosen?.provider||!connected||chosen.key!==connected.key)return;
    const provider=chosen.provider;
    if(typeof provider.on!=='function')return;
    const accountChanged=()=>{
      setConnected(null);
      if(session?.rootKey===chosen.key)clearSession();
    };
    const chainChanged=()=>setConnected(null);
    provider.on('accountsChanged',accountChanged);
    provider.on('disconnect',accountChanged);
    provider.on('chainChanged',chainChanged);
    return ()=>{
      if(typeof provider.removeListener==='function'){
        provider.removeListener('accountsChanged',accountChanged);
        provider.removeListener('disconnect',accountChanged);
        provider.removeListener('chainChanged',chainChanged);
      }
    };
  },[chosen,connected,session?.rootKey,clearSession]);

  // Continue watching the authenticated root EOA even when another wallet
  // provider is selected for linking. Revoke the in-memory session on root
  // account changes/disconnects, not on unrelated provider chain switches.
  useEffect(()=>{
    if(!rootProvider?.provider||rootProvider.key===chosen?.key)return;
    const provider=rootProvider.provider;
    if(typeof provider.on!=='function')return;
    const invalidate=()=>clearSession();
    provider.on('accountsChanged',invalidate);
    provider.on('disconnect',invalidate);
    return ()=>{
      if(typeof provider.removeListener==='function'){
        provider.removeListener('accountsChanged',invalidate);
        provider.removeListener('disconnect',invalidate);
      }
    };
  },[rootProvider,chosen?.key,clearSession]);

  useEffect(()=>{
    if(!sessionValid){setLinks([]);return;}
    const controller=new AbortController();let live=true;
    qaRequest(BASE,'ownership/links',{token:session.token,signal:controller.signal})
      .then(result=>{if(live)setLinks(Array.isArray(result.wallets)?result.wallets:[]);})
      .catch(()=>{if(live)setLinks([]);});
    return ()=>{live=false;controller.abort()};
  },[session?.token,sessionValid]);

  async function execute(fn){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      if(!safe)throw Error('Ambiente de homologação indisponível ou incorreto.');
      await fn();
    }catch(e){
      if(e?.status===401)clearSession();
      setError(readable(e));
    }finally{setBusy(false);}
  }
  async function connect(){
    return execute(async()=>{
      if(!chosen)throw Error('Instale e selecione uma carteira compatível no navegador.');
      const address=await activeAccount(chosen.provider,{requestConnection:true});
      await requirePolygon(chosen.provider);
      // The active QA identity is the previously signed ROOT, not whichever
      // address this wallet exposes. Keep the session for a second wallet.
      const transition=nextQaConnectionState(session,chosen.key,address);
      if(!transition.session&&session)clearSession();
      setConnected(transition.connected);
      setNotice(transition.session
        ?'Carteira pronta para vínculo na sessão QA existente. Nenhum ativo foi movimentado.'
        :'Carteira conectada. A assinatura de entrada não movimenta ativos.');
    });
  }
  function checkedWallet(){
    if(!chosen||!connected||connected.key!==chosen.key)throw Error('Conecte a carteira selecionada.');
    return {wallet:chosen,address:verifiedAddress(connected.address)};
  }
  async function sign(purpose){
    if(purpose==='link'&&!sessionValid)throw Error('Sessão QA inválida ou expirada.');
    const {wallet,address}=checkedWallet();
    await activeAccount(wallet.provider,{expectedAddress:address});
    await requirePolygon(wallet.provider);
    const route=purpose==='login'?'qa/auth/challenge':'ownership/challenge';
    const challenge=await qaRequest(BASE,route,{
      method:'POST',token:purpose==='link'?session.token:undefined,
      body:{walletAddress:address,market},
    });
    const options=challengeOptions({walletAddress:address,market,domain:DOMAIN,purpose});
    const signature=await signCanonicalQaChallenge(wallet.provider,challenge,options);
    return {challengeId:challenge.challengeId,signature,address};
  }
  function requireSession(){
    if(!sessionValid){clearSession();throw Error('A sessão de testes expirou. Assine novamente.');}
    return session.token;
  }
  async function login(){
    return execute(async()=>{
      const proof=await sign('login');
      const result=await qaRequest(BASE,'qa/auth/verify',{method:'POST',
        body:{challengeId:proof.challengeId,signature:proof.signature}});
      if(result.mode!=='ISOLATED_QA_TEST_WALLET'||result.financialExecutionAllowed!==false||
         typeof result.accessToken!=='string'||result.accessToken.length<30||
         !Number.isInteger(result.expiresInSeconds)||result.expiresInSeconds>1800)
        throw Error('A API não confirmou o isolamento financeiro da sessão.');
      setSession({token:result.accessToken,root:proof.address,rootKey:chosen.key,
        expiresAt:Date.now()+result.expiresInSeconds*1000});
      setNotice('Assinatura validada. Sessão QA autorizada por 30 minutos.');
    });
  }
  async function link(){
    return execute(async()=>{
      const token=requireSession();
      const proof=await sign('link');
      const result=await qaRequest(BASE,'ownership/verify',{method:'POST',token,
        body:{challengeId:proof.challengeId,signature:proof.signature,market}});
      if(result.bound!==true||result.financialAction!==false||
         result.ledgerCredited!==false||
         verifiedAddress(result.address)!==proof.address)
        throw Error('Vínculo não confirmado com segurança.');
      const fresh=await qaRequest(BASE,'ownership/links',{token});
      setLinks(Array.isArray(fresh.wallets)?fresh.wallets:[]);
      setNotice('Carteira vinculada somente à identidade QA. Nenhum USDC foi movimentado.');
    });
  }
  async function unlink(address){
    return execute(async()=>{
      const token=requireSession();
      const result=await qaRequest(BASE,'ownership/link',{method:'DELETE',
        token,body:{walletAddress:address}});
      if(result.revoked!==true||result.financialAction!==false)
        throw Error('Desvinculação não confirmada.');
      const fresh=await qaRequest(BASE,'ownership/links',{token});
      setLinks(Array.isArray(fresh.wallets)?fresh.wallets:[]);
      setNotice('Carteira desvinculada no laboratório.');
    });
  }
  function choose(key){setSelectedKey(key);setConnected(null);setError('');setNotice('');}
  function setTestMarket(next){setMarket(next);clearWallet();}
  if(!QA_ENABLED)return <p>Ambiente de testes desativado.</p>;
  return <div className="portal-page">
    <header className="topbar">
      <div className="brand"><span className="brand-wordmark">NEX<span>A</span></span>
        <small>WALLET CONNECT · QA</small></div>
      <button type="button" className="secondary-button" onClick={()=>{clearWallet();setSelectedKey('');}}>
        Encerrar sessão QA
      </button>
    </header>
    <main className="portal-content">
      <section className="hero-card">
        <div>
          <span className="external-wallet-pill">LABORATÓRIO NÃO FINANCEIRO</span>
          <h1>Conecte sua carteira à Nexa</h1>
          <p>Teste a assinatura e o vínculo de carteiras externas usando a rede Polygon.
            Não acessamos seu saldo, não pedimos chave privada e não transferimos USDC.</p>
        </div>
        <div className="wallet-summary"><span>Rede de teste do vínculo</span><strong>Polygon · 137</strong>
          <small>USDC nativo · futura taxa de entrada Nexa: 0%</small></div>
      </section>
      <section className="content-card external-wallet-lab">
        <h2>1. Conectar uma carteira</h2>
        <p className="muted">Como funciona: escolha Brasil ou Global, selecione sua carteira, clique em Conectar, assine a mensagem de entrada e assine novamente para vinculá-la. Essas assinaturas não autorizam envio de USDC, Pix nem taxas.</p>
        <p className="muted">MetaMask, Rabby e extensões compatíveis com EIP-6963.
          No celular, abra esta página no navegador interno da carteira. Conexão por QR WalletConnect ainda não está habilitada.</p>
        <label className="external-wallet-field">Mercado
          <select value={market} disabled={busy||sessionValid} onChange={e=>setTestMarket(e.target.value)}>
            <option value="BR">Nexa Brasil</option><option value="GLOBAL">Nexa Global</option>
          </select>
        </label>
        <label className="external-wallet-field">Carteira encontrada
          <select value={selectedKey} disabled={busy} onChange={e=>choose(e.target.value)}>
            <option value="">Escolha uma carteira</option>
            {providers.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        {providers.length===0&&<p className="notice notice-info">Nenhuma extensão EVM encontrada.
          Instale MetaMask ou Rabby, ative a extensão e reabra esta página.</p>}
        <div className="external-wallet-actions">
          <button type="button" className="secondary-button" disabled={!safe||busy||!chosen} onClick={connect}>
            {busy?'Confirmando…':'Conectar carteira'}
          </button>
          {connected&&<span className="muted">Endereço ativo: {short(connected.address)}</span>}
        </div>
        {connected&&!sessionValid&&<div className="external-wallet-actions">
          <button type="button" className="primary-button" disabled={busy||!safe} onClick={login}>
            Assinar mensagem e entrar no QA
          </button>
        </div>}
        {sessionValid&&<p className="notice notice-info">
          Sessão de teste autenticada: {short(session.root)}. Para vincular outra carteira,
          selecione-a acima, conecte o endereço e confirme uma segunda assinatura.
        </p>}
      </section>
      {sessionValid&&<section className="content-card external-wallet-lab">
        <h2>2. Vincular e gerenciar carteiras</h2>
        <p className="muted">O vínculo fica somente no banco isolado. Uma assinatura não autoriza
          transferências, aprovações de tokens ou operações na Nexa.</p>
        <button type="button" className="primary-button" onClick={link}
          disabled={busy||!connected||!safe}>
          Assinar e vincular carteira selecionada
        </button>
        <div className="external-wallet-linked">
          <strong>Carteiras vinculadas à identidade QA</strong>
          {links.length===0?<p className="muted">Nenhum vínculo ativo.</p>:
            links.map(x=><div className="external-wallet-linked-row"
              key={x.address+'-'+x.market}>
              <span>{short(x.address)} · {x.market} · Polygon</span>
              <button type="button" className="text-button" onClick={()=>unlink(x.address)}
                disabled={busy}>Desvincular</button>
            </div>)}
        </div>
      </section>}
      {error&&<p className="notice notice-warning" role="alert">{error}</p>}
      {notice&&<p className="notice notice-info" role="status">{notice}</p>}
      <section className="content-card" style={{marginTop:18}}>
        <h2>Sobre esta homologação</h2>
        <p className="muted">Identidade QA separada da Nexa de produção, sem Privy, contas bancárias,
          saques, Pix, swaps, aprovações ou crédito no ledger. Não envie dinheiro para testar o vínculo.</p>
      </section>
    </main>
  </div>;
}