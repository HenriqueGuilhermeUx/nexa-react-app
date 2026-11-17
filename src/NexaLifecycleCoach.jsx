import {useCallback, useEffect, useState} from 'react';
import {kycRecoverySnapshot} from './kyc-stage-fallback.mjs';
import {prepareBrazilDiditStart} from './kyc-start-contract.mjs';

const STAGES = [
  ['identity','Identidade'], ['firstRecordedFunding','Primeira entrada registrada'],
  ['recurringPix','Pix recorrente'], ['otherAssetHistory','Outros ativos'],
];

const STATUS = {
  complete:'Concluída',
  in_review:'Em análise',
  needs_support:'Precisa de suporte',
  pending:'Pendente',
  confirmed_in_checked_sources:'Registrada',
  not_confirmed:'Ainda não confirmada',
  provider_linked:'Vinculada ao provedor',
  requires_provider_confirmation:'Aguardando confirmação do provedor',
  not_configured:'Não configurado',
  paused:'Pausado',
  cancelled:'Cancelado',
  recorded:'Registrado',
};

function apiError(response) {
  if (response.status === 401) return 'Sua sessão expirou. Entre novamente na Nexa.';
  if (response.status === 403) return 'Sua conta não pode acessar este recurso no momento.';
  return 'Não foi possível consultar a jornada agora.';
}

export default function NexaLifecycleCoach({accessToken, apiBaseUrl}) {
  const [snapshot,setSnapshot] = useState(null);
  const [loading,setLoading] = useState(Boolean(accessToken));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [kycConsent,setKycConsent] = useState(false);
  const [kycBusy,setKycBusy] = useState(false);
  const [kycFeedback,setKycFeedback] = useState('');

  const load = useCallback(async (signal) => {
    if (!accessToken) {setLoading(false);setSnapshot(null);return;}
    setLoading(true);setError('');setSnapshot(null);
    try {
      const response = await fetch(apiBaseUrl + '/lifecycle/me', {
        headers:{Authorization:'Bearer ' + accessToken,Accept:'application/json'},
        cache:'no-store',
        signal,
      });
      if (!response.ok) {
        const issue = new Error(apiError(response));
        issue.httpStatus = response.status;
        throw issue;
      }
      const body = await response.json();
      if (!body?.success || !body?.nextAction) throw new Error('Jornada temporariamente indisponível.');
      setSnapshot(body);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // /lifecycle/me is an optional overview. If it is unavailable,
      // /kyc/didit/me can independently recover only the authenticated
      // verification step. Never fall back on 401/403 authentication failure.
      if (![401,403].includes(err?.httpStatus)) {
        try {
          const kycRes = await fetch(apiBaseUrl + '/kyc/didit/me', {
            headers:{Authorization:'Bearer ' + accessToken,Accept:'application/json'},
            cache:'no-store',signal,
          });
          if (kycRes.ok) {
            const recovery = kycRecoverySnapshot(await kycRes.json());
            if (recovery && !signal?.aborted) {
              setSnapshot(recovery);
              setError('Não conseguimos mostrar a jornada completa, mas sua verificação continua disponível.');
              return;
            }
          }
        } catch (fallbackErr) {
          if (fallbackErr?.name === 'AbortError') return;
        }
      }
      if (!signal?.aborted) setError(err?.message || 'Falha ao consultar jornada.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  },[accessToken,apiBaseUrl]);

  useEffect(()=>{
    const controller=new AbortController();
    load(controller.signal);
    return ()=>controller.abort();
  },[load]);

  const startKyc = async () => {
    if (!accessToken || kycBusy) return;
    if (!kycConsent) {
      setKycFeedback('Confirme o consentimento explícito antes de iniciar.');
      return;
    }
    setKycBusy(true);setKycFeedback('');
    try {
      // This function is unit-tested using injected fake requests.
      // It never initiates KYC without the user's explicit checkbox + click.
      const outcome = await prepareBrazilDiditStart({
        accessToken,apiBaseUrl,consent:kycConsent,fetchImpl:fetch,
      });
      if (outcome.kind === 'redirect') {
        window.location.assign(outcome.url);
        return;
      }
      if (outcome.kind === 'approved' || outcome.kind === 'manual_review') {
        setKycFeedback(outcome.message);
        if (outcome.kind === 'approved') await load();
      }
    } catch (err) {
      setKycFeedback(err?.message || 'Não foi possível iniciar a verificação agora.');
    } finally {
      setKycBusy(false);
    }
  };

  const refreshKycStatus = async () => {
    if (!accessToken || kycBusy) return;
    setKycBusy(true); setKycFeedback('');
    try {
      const res = await fetch(apiBaseUrl+'/kyc/didit/me',{
        headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},
        cache:'no-store',
      });
      if(!res.ok) throw new Error(apiError(res));
      const data=await res.json();
      setKycFeedback(data.kycStatus==='approved'
        ? 'Sua verificação foi aprovada.'
        : 'Status consultado. Se permanecer em análise, aguarde orientação do provedor ou suporte.');
      await load();
    } catch(err) {
      setKycFeedback(err?.message||'Não foi possível atualizar o status.');
    } finally {
      setKycBusy(false);
    }
  };

  const setEducationOptIn = async (nextValue, nextFrequency = 'weekly') => {
    if (!accessToken || saving) return;
    setSaving(true);setError('');
    try {
      const res=await fetch(apiBaseUrl+'/lifecycle/preferences',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
        body:JSON.stringify({educationalEmailOptIn:nextValue,emailFrequency:nextFrequency}),
      });
      if (!res.ok) throw new Error(apiError(res));
      const result=await res.json();
      if (!result.success || result.optedIn !== nextValue || (nextValue && result.frequency !== nextFrequency)) throw new Error('Não foi possível confirmar a preferência no servidor.');
      setSnapshot(prev=>prev?{...prev,educationalEmail:{
        ...prev.educationalEmail,optedIn:result.optedIn,
        consentAt:result.consentAt,frequency:result.frequency,
        deliveryEnabled:result.deliveryEnabled,dailyDeliveryEnabled:false,
      }}:prev);
    } catch (err) {
      setError(err?.message || 'Erro ao salvar preferência.');
    } finally {setSaving(false);}
  };

  return (
    <section aria-label="Sua jornada na Nexa" style={{marginTop:12}}>
      {loading && <p role="status">Consultando sua jornada com segurança…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && snapshot && <>
        <h3>{snapshot.nextAction.title}</h3>
        <p>{snapshot.nextAction.description}</p>
        {(() => {
          const destination = snapshot.nextAction?.destination;
          if (typeof destination !== 'string' ||
            !/^https:\/\/trynexa\.com\.br(?:\/|$)/.test(destination)) return null;
          return (
            <p><a className="text-button" href={destination}>
              {snapshot.nextAction.actionLabel || 'Abrir Nexa'}
            </a></p>
          );
        })()}

        {(snapshot.stage==='first_deposit' || snapshot.stage==='next_deposit' || snapshot.stage==='recurring') && (
          <div style={{padding:14,border:'1px solid #64748b55',borderRadius:10,margin:'12px 0'}}>
            <strong>{snapshot.stage==='first_deposit'
              ? 'Conheça como fazer sua primeira entrada com Pix'
              : 'Consulte as opções para uma nova entrada ou conheça a recorrência'}</strong>
            <p>Confira a cotação, os custos e os riscos antes de decidir. Nenhuma operação será iniciada ou confirmada automaticamente.</p>
            <a className="text-button" href="/wallet-v148.html?tab=deposit">
              Abrir opções de adicionar com Pix
            </a>
          </div>
        )}
        {snapshot.stage==='kyc' && (
          <div style={{padding:14,border:'1px solid #64748b55',borderRadius:10,margin:'12px 0'}}>
            <strong>Faça a verificação facial preferencialmente no celular</strong>
            <p>Use um celular com câmera, boa iluminação e seu documento. A captura e a verificação biométrica acontecem no ambiente oficial da Didit, após sua autorização.</p>
            <p>Se você começou no computador, abra <a href="https://trynexa.com.br/portal/" target="_blank" rel="noopener noreferrer">trynexa.com.br/portal/</a> no celular e entre na mesma conta Nexa. Depois escolha <strong>Iniciar verificação segura</strong>. Não envie links com sessão, fotos de documentos, códigos ou senhas a terceiros.</p>
            <p>Também é possível continuar neste dispositivo quando houver câmera compatível. Não é necessário depositar antes do KYC.</p>
            <p>Seus documentos e dados biométricos são fornecidos no ambiente oficial de verificação da Didit, nunca pelo WhatsApp.</p>
            <label style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              <input type="checkbox" checked={kycConsent} disabled={kycBusy}
                onChange={event=>setKycConsent(event.target.checked)}/>
              <span>Autorizo o início da verificação de identidade e biometria no provedor indicado pela Nexa.</span>
            </label>
            <button type="button" onClick={startKyc} disabled={kycBusy || !kycConsent}>
              {kycBusy?'Iniciando…':'Iniciar verificação segura'}
            </button>
            <p style={{marginTop:10}}><small>A verificação não exige depósito. Seus dados são enviados à Didit somente após sua autorização.</small></p>
            <p><small>Precisa de ajuda? <a href="https://t.me/NexaTheoBot" target="_blank" rel="noopener noreferrer">Fale com Theo no Telegram</a>, sem enviar documentos, senhas ou códigos.</small></p>
          </div>
        )}
        {(snapshot.stage==='kyc_review'||snapshot.stage==='kyc_assistance') && (
          <button type="button" disabled={kycBusy} onClick={refreshKycStatus}>
            {kycBusy?'Consultando…':'Atualizar situação do KYC'}
          </button>
        )}
        {kycFeedback && <p role="status">{kycFeedback}</p>}
        <p><small>Orientações educativas, não recomendações de investimento. Toda operação exige sua própria decisão e confirmação.</small></p>
        {!snapshot.recoveryOnly && <div style={{padding:12,border:'1px solid #64748b55',borderRadius:10}}>
          <strong>Conteúdo educativo: escolha a frequência</strong>
          <p>Opcional e revogável. Conteúdo geral sobre segurança e ativos digitais, sem recomendações individuais. A opção diária registra interesse; não habilita disparos automáticos.</p>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency" checked={!snapshot.educationalEmail?.optedIn}
              disabled={saving} onChange={()=>setEducationOptIn(false,'weekly')}/>
            Não receber
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency"
              checked={Boolean(snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency !== 'daily')}
              disabled={saving} onChange={()=>setEducationOptIn(true,'weekly')}/>
            Semanal — orientações educativas
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency"
              checked={Boolean(snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency === 'daily')}
              disabled={saving} onChange={()=>setEducationOptIn(true,'daily')}/>
            Diário — registrar interesse em boletim sobre cripto (não enviado ainda)
          </label>
          {snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency === 'daily' &&
            <p><small>Interesse diário registrado. O envio diário ainda está desativado; esta escolha substitui a preferência semanal.</small></p>}
          {snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency !== 'daily' && !snapshot.educationalEmail?.deliveryEnabled &&
            <p><small>O envio semanal não está disponível neste momento. Sua escolha foi registrada.</small></p>}
        </div>}
        <div className="grid" style={{margin:'14px 0'}}>
          {STAGES.map(([field,label])=><div key={field} style={{padding:12,border:'1px solid #64748b55',borderRadius:10}}>
            <strong>{label}</strong>
            <p>{STATUS[snapshot.milestones?.[field]] || snapshot.milestones?.[field] || 'Não informado'}</p>
          </div>)}
        </div>
        <h4>Aprenda no seu ritmo</h4>
        <ul>
          {(snapshot.educationalContent || []).map(item=>(
            <li key={item.id} style={{marginBottom:10}}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
              <p>{item.summary}</p>
              <small>Fonte: {item.sourceLabel}</small>
            </li>
          ))}
        </ul>

      </>}
    </section>
  );
}
