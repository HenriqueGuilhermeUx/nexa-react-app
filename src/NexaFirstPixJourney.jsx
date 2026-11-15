import {useState} from 'react';

const CLIENT_STAGES = new Set(['deposit_screen_opened','pix_method_selected']);

/**
 * Authenticated, non-financial instrumentation. No amounts, PII, QR codes,
 * payment IDs, or transaction data are collected. Best-effort only.
 */
async function reportJourneyStage({stage,accessToken,apiBaseUrl}) {
  if (!CLIENT_STAGES.has(stage) || !accessToken) return;
  try {
    await fetch(apiBaseUrl+'/deposit-journey/event',{
      method:'POST',headers:{
        Authorization:'Bearer '+accessToken,'Content-Type':'application/json',
      },
      body:JSON.stringify({stage,eventId:crypto.randomUUID()}),
      keepalive:false,
    });
  } catch { /* Never block account navigation or a financial operation. */ }
}

export default function NexaFirstPixJourney({accessToken,apiBaseUrl,kycStatus}) {
  const [open,setOpen]=useState(false);
  const [method,setMethod]=useState('');
  if(String(kycStatus||'').toLowerCase()!=='approved' || !accessToken) return null;

  const showGuide=()=>{
    setOpen(true);
    if(!open) void reportJourneyStage({stage:'deposit_screen_opened',accessToken,apiBaseUrl});
  };
  const choosePix=()=>{
    setMethod('pix');
    void reportJourneyStage({stage:'pix_method_selected',accessToken,apiBaseUrl});
  };

  return (
    <section className="hero-card" aria-label="Primeiro depósito na Nexa">
      <StatusLabel />
      <h2>Seu primeiro depósito, sem complicação</h2>
      <p>Com sua identidade aprovada, você pode conhecer como colocar saldo na Nexa. O primeiro depósito é opcional.</p>
      {!open ? (
        <button type="button" className="secondary-button" onClick={showGuide}>
          Entender como depositar
        </button>
      ) : (
        <div>
          <p>Antes de continuar, escolha um método para conhecer as etapas.</p>
          <button type="button" className="secondary-button" onClick={choosePix}
            aria-pressed={method==='pix'}>Pix — adicionar reais</button>
          {method==='pix' && (
            <div className="notice notice-info" aria-live="polite">
              <p>Para depositar via Pix, abra a função de depósitos disponível na sua conta Nexa, confira o valor, o destinatário, as taxas, a cotação de USDC e os prazos antes de autorizar no seu banco.</p>
              <p>O portal ainda não gera uma cobrança Pix diretamente nesta seção. Não foi criado QR Code, não houve débito e nenhuma compra foi realizada.</p>
              <p>Se a opção não aparecer, consulte os canais oficiais de suporte da Nexa. Não envie senhas nem comprovantes por mensagens abertas.</p>
            </div>
          )}
          <button type="button" className="text-button" onClick={()=>{setOpen(false);setMethod('');}}>
            Fechar orientação
          </button>
        </div>
      )}
    </section>
  );
}

function StatusLabel() {
  return <span className="status-pill">IDENTIDADE VERIFICADA</span>;
}
