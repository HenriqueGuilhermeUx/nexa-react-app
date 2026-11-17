import {useEffect,useState} from 'react';
import {useWallets} from '@privy-io/react-auth';
import {
  AAVE_CHAIN, parsePilotDecimal, validateAavePilotQuote,
  sendAavePilotStep, getAavePilotReceipt,
} from './aavePilotWallet.js';

const shorten=(address)=>address?address.slice(0,10)+'…'+address.slice(-6):'';
const usdc=(raw)=>{
  try{
    const n=BigInt(raw);return (n/1000000n)+','+
      String(n%1000000n).padStart(6,'0').replace(/0+$/,'').padEnd(2,'0')+' USDC';
  }catch{return 'indisponível';}
};
function findWallet(wallets,address){
  const expected=String(address||'').toLowerCase();
  const wallet=wallets.find(w=>String(w?.address||'').toLowerCase()===expected&&
    (w?.walletClientType==='privy'||w?.walletClientType==='embedded'||
     w?.connectorType==='embedded'));
  if(!wallet)throw Error('Entre na Privy com a carteira vinculada à sua conta Nexa.');
  return wallet;
}
async function walletProvider(wallet){
  const p=typeof wallet.getEthereumProvider==='function'
    ?await wallet.getEthereumProvider()
    :typeof wallet.getProvider==='function'?await wallet.getProvider():null;
  if(!p||typeof p.request!=='function')throw Error('A carteira não disponibilizou autenticação on-chain.');
  return p;
}

/**
 * Pilot is OFF until the backend confirms KYC, legal approval, current Privy
 * ownership, Polygon native USDC reserve and explicit user allowlist.
 * Each spend/contract action is individually signed in the user's browser.
 * No backend-managed wallet or auto-sign, ever.
 */
export default function AaveRealWallet({accessToken,apiUrl}){
  const {wallets=[]}=useWallets();
  const [status,setStatus]=useState(null);
  const [loading,setLoading]=useState(true);
  const [action,setAction]=useState('SUPPLY');
  const [amount,setAmount]=useState('1');
  const [accepted,setAccepted]=useState(false);
  const [quote,setQuote]=useState(null);
  const [pending,setPending]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const base=apiUrl.replace(/\/$/,'')+'/invest-credit/aave/pilot/';

  async function call(path,body){
    if(!accessToken)throw Error('Entre na Nexa para verificar seu acesso Aave.');
    if(!apiUrl.startsWith('https://'))throw Error('API HTTPS necessária.');
    const r=await fetch(base+path,{
      method:body?'POST':'GET',
      headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    if(!r.ok){
      if(r.status===403)throw Error('Sua conta não está habilitada para este piloto Aave.');
      if(r.status===503)throw Error('Não foi possível confirmar condições atuais. Nada foi movimentado.');
      throw Error('Consulta Aave indisponível ('+r.status+').');
    }
    return r.json();
  }

  useEffect(()=>{
    let active=true;setLoading(true);
    if(!accessToken){setStatus(null);setLoading(false);return()=>{active=false;};}
    call('status').then(data=>{
      if(!active)return;
      if(data?.success!==true||data.chainId!==AAVE_CHAIN||
        data.borrowEnabled!==false||data.repayEnabled!==false||
        data.requiresWalletConfirmation!==true)throw Error('Resposta Aave inválida.');
      setStatus(data);
    }).catch(()=>{
      if(active){setStatus(null);setError('A movimentação Aave não pôde ser validada.');}
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[accessToken,apiUrl]);

  function clear(){
    setQuote(null);setPending(null);setNotice('');setError('');
  }
  async function review(e){
    e.preventDefault();
    if(!status?.pilotEnabled||!accepted||pending||busy)return;
    setBusy(true);clear();
    try{
      parsePilotDecimal(amount);
      const q=await call('prepare',{
        action,amountUsdc:amount.replace(',','.'),chainId:AAVE_CHAIN,riskAcknowledged:true,
      });
      const w=findWallet(wallets,q.walletAddress);
      validateAavePilotQuote(q,w.address);
      setQuote(q);
      setNotice('Revise a carteira, o contrato, o valor e cada etapa antes de confirmar.');
    }catch(e){setError(e?.message||'Não foi possível preparar a operação.');}
    finally{setBusy(false);}
  }
  async function sign(){
    if(!quote||pending||busy||!status?.pilotEnabled)return;
    setBusy(true);setError('');
    try{
      const w=findWallet(wallets,quote.walletAddress);
      const provider=await walletProvider(w);
      const {hash,step}=await sendAavePilotStep(provider,quote,w.address);
      setQuote(null);setPending({hash,step,owner:w.address});
      setNotice('A transação já foi enviada. Não repita a operação enquanto confirma.');
    }catch(e){setError(e?.message||'A carteira não confirmou a transação.');}
    finally{setBusy(false);}
  }
  async function verify(){
    if(!pending||busy)return;
    setBusy(true);setError('');
    try{
      const w=findWallet(wallets,pending.owner),provider=await walletProvider(w);
      const result=await getAavePilotReceipt(provider,pending.hash,pending.owner,pending.step.to);
      if(result==='pending'){setNotice('Transação aguardando confirmação. Não repita.');return;}
      const kind=pending.step.kind;setPending(null);
      if(result==='failed'){setNotice('Transação falhou na blockchain; gás pode ter sido consumido.');return;}
      setNotice(kind==='APPROVAL'
        ?'Autorização limitada confirmada. Revise novamente para aplicar, com dados novos.'
        :kind==='SUPPLY'
          ?'USDC aplicado na Aave! Verifique sua posição e seus aTokens.'
          :'USDC retirado da Aave para sua carteira.');
    }catch(e){setError(e?.message||'Não foi possível verificar recibo da transação.');}
    finally{setBusy(false);}
  }

  return (
    <section className="content-card" aria-label="Aave · movimentações com carteira">
      <h2>Aave com sua própria carteira</h2>
      <p className="muted">Deposite e retire USDC na Aave V3 Polygon com confirmação direta na carteira Privy. A Nexa não controla os seus fundos.</p>
      {loading&&<p role="status">Verificando autorização de acesso…</p>}
      {!loading&&!status?.pilotEnabled&&(
        <div className="notice notice-info" role="status">
          O acesso a aplicações reais ainda não foi habilitado para esta conta. Crédito e amortização não estão disponíveis no piloto.
        </div>
      )}
      {status?.pilotEnabled&&(
        <>
          <div className="notice notice-info">Seu acesso ao piloto foi autorizado. Cada aprovação e depósito é uma transação distinta: nenhuma é realizada sem sua confirmação.</div>
          <form onSubmit={review}>
            <fieldset disabled={busy||Boolean(pending)} style={{border:'none',padding:0}}>
              <legend>Escolha a operação</legend>
              <label><input type="radio" checked={action==='SUPPLY'}
                onChange={()=>{setAction('SUPPLY');clear();}}/> Aplicar USDC</label>
              <label style={{marginLeft:14}}><input type="radio" checked={action==='WITHDRAW'}
                onChange={()=>{setAction('WITHDRAW');clear();}}/> Retirar USDC</label>
              <label style={{display:'block',marginTop:12}}>Quantidade (1 a 100 USDC por solicitação)
                <input required type="text" inputMode="decimal" value={amount}
                  onChange={e=>{setAmount(e.target.value);clear();}} placeholder="1.00"
                  pattern="[0-9]+([.,][0-9]{1,6})?"/>
              </label>
              <label style={{display:'flex',gap:10,alignItems:'flex-start',margin:'14px 0'}}>
                <input type="checkbox" checked={accepted}
                  onChange={e=>{setAccepted(e.target.checked);clear();}}/>
                <span>Entendo riscos de perda, falha de contrato, variação das taxas, falta de liquidez e custos de gás na Polygon.</span>
              </label>
              <button className="primary-button" type="submit" disabled={!accepted||busy}>Revisar operação na blockchain</button>
            </fieldset>
          </form>
        </>
      )}
      {quote&&status?.pilotEnabled&&(
        <div className="notice notice-info" style={{marginTop:16}}>
          <h3>Confirmação individual</h3>
          <p>{quote.action==='SUPPLY'?'Aplicar':'Retirar'} {usdc(quote.amountBaseUnits)} · Carteira {shorten(quote.walletAddress)}</p>
          <p>USDC disponível: {usdc(quote.quote.usdcBalanceUnits)} · aUSDC na Aave: {usdc(quote.quote.aUsdcBalanceUnits)}</p>
          <p>APR variável observado: {Number.isFinite(quote.quote.variableSupplyAprBps)?
            (quote.quote.variableSupplyAprBps/100).toFixed(2)+'% ao ano (não garantido)':'não disponível'}</p>
          <p>{quote.quote.steps[0]?.kind==='APPROVAL'
            ?'Primeira etapa: autorizar somente o valor exato do USDC no contrato Aave. Depois será necessário revisar e confirmar o depósito.'
            :'Esta etapa requer sua confirmação na carteira Privy.'}</p>
          <p className="muted">{quote.warning}</p>
          <button className="primary-button" onClick={sign} disabled={busy}>Confirmar etapa na minha carteira</button>
        </div>
      )}
      {pending&&(
        <div className="notice notice-info" style={{marginTop:16}}>
          <strong>Confirmação pendente</strong>
          <p>Transação: {shorten(pending.hash)} — não envie novamente.</p>
          <button className="secondary-button" onClick={verify} disabled={busy}>Verificar confirmação</button>
        </div>
      )}
      {notice&&<p role="status" style={{color:'var(--success)'}}>{notice}</p>}
      {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
      <p className="muted"><small>O protocolo Aave é independente. Rendimentos não são garantidos; retiradas dependem de liquidez. Nesta fase, crédito e amortização permanecem bloqueados. Não há assinatura automática.</small></p>
    </section>
  );
}
