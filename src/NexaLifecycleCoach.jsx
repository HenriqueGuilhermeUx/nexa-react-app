import {useCallback, useEffect, useState} from 'react';

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

function safeDiditUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !(
      host === 'didit.me' || host.endsWith('.didit.me') ||
      host === 'didit.io' || host.endsWith('.didit.io')
    )) return null;
    return url.href;
  } catch { return null; }
}

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
    setLoading(true);setError('');
    try {
      const response = await fetch(apiBaseUrl + '/lifecycle/me', {
        headers:{Authorization:'Bearer ' + accessToken,Accept:'application/json'},
        cache:'no-store',
        signal,
      });
      if (!response.ok) throw new Error(apiError(response));
      const body = await response.json();
      if (!body?.success || !body?.nextAction) throw new Error('Jornada temporariamente indisponível.');
      setSnapshot(body);
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Falha ao consultar jornada.');
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
    setKycBusy(true); setKycFeedback('');
    try {
      const headers = {Authorization:'Bearer '+accessToken,Accept:'application/json'};
      const profileRes = await fetch(apiBaseUrl+'/user/me',{headers,cache:'no-store'});
      if(!profileRes.ok) throw new Error(apiError(profileRes));
      const profile = await profileRes.json();
      if(String(profile?.residenceCountry || 'BR').toUpperCase() !== 'BR') {
        throw new Error('Este fluxo é exclusivo para residentes no Brasil. Procure o suporte para outra jurisdição.');
      }
      // Reuse an existing valid session instead of starting duplicate biometric sessions.
      const currentRes = await fetch(apiBaseUrl+'/kyc/didit/me',{headers,cache:'no-store'});
      if(!currentRes.ok) throw new Error('Não foi possível verificar se já existe uma sessão Didit. Tente novamente antes de criar outra.');
      if(currentRes.ok) {
        const current = await currentRes.json();
        if(current.kycStatus === 'approved') {
          setKycFeedback('Sua verificação já foi aprovada.');
          await load();
          return;
        }
        if(current.manualReviewRequired) {
          setKycFeedback('Existe uma revisão manual pendente. A equipe Nexa precisa orientar a continuidade.');
          return;
        }
        const existingUrl = safeDiditUrl(current.verificationUrl);
        const existingStatus = String(current.diditSessionStatus || '').toLowerCase();
        if(existingUrl && !/(expired|failed|cancelled|canceled|rejected|completed)/.test(existingStatus)) {
          window.location.assign(existingUrl);
          return;
        }
      }
      const response = await fetch(apiBaseUrl+'/kyc/didit/brazil/start',{
        method:'POST',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({consent:true}),
      });
      const result = await response.json().catch(()=>({}));
      if(!response.ok) {
        throw new Error(typeof result.message === 'string' ? result.message : apiError(response));
      }
      if(result.alreadyApproved) {
        setKycFeedback('Sua identidade já está aprovada.');
        await load();
        return;
      }
      if(result.manualReviewRequired) {
        setKycFeedback('Seu caso precisa de revisão humana; nenhuma nova sessão foi iniciada.');
        return;
      }
      const url = safeDiditUrl(result.verificationUrl);
      if(!url) throw new Error('A verificação não retornou um link oficial reconhecido. Procure o suporte.');
      window.location.assign(url);
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

  const setEducationOptIn = async (nextValue) => {
    if (!accessToken || saving) return;
    setSaving(true);setError('');
    try {
      const res=await fetch(apiBaseUrl+'/lifecycle/preferences',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
        body:JSON.stringify({educationalEmailOptIn:nextValue,emailFrequency:'weekly'}),
      });
      if (!res.ok) throw new Error(apiError(res));
      const result=await res.json();
      if (!result.success) throw new Error('Preferências não puderam ser atualizadas.');
      setSnapshot(prev=>prev?{...prev,educationalEmail:{
        ...prev.educationalEmail,optedIn:result.optedIn,
        consentAt:result.consentAt,deliveryEnabled:result.deliveryEnabled,
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
            <strong>Concluir identidade com segurança</strong>
            <p>Seus documentos e dados biométricos são fornecidos no ambiente oficial de verificação da Didit, nunca pelo WhatsApp.</p>
            <label style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              <input type="checkbox" checked={kycConsent} disabled={kycBusy}
                onChange={event=>setKycConsent(event.target.checked)}/>
              <span>Autorizo o início da verificação de identidade e biometria no provedor indicado pela Nexa.</span>
            </label>
            <button type="button" onClick={startKyc} disabled={kycBusy || !kycConsent}>
              {kycBusy?'Iniciando…':'Iniciar verificação segura'}
            </button>
          </div>
        )}
        {(snapshot.stage==='kyc_review'||snapshot.stage==='kyc_assistance') && (
          <button type="button" disabled={kycBusy} onClick={refreshKycStatus}>
            {kycBusy?'Consultando…':'Atualizar situação do KYC'}
          </button>
        )}
        {kycFeedback && <p role="status">{kycFeedback}</p>}
        <p><small>Orientações educativas, não recomendações de investimento. Toda operação exige sua própria decisão e confirmação.</small></p>
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
        <div style={{padding:12,border:'1px solid #64748b55',borderRadius:10}}>
          <strong>Conteúdo educativo semanal por e-mail</strong>
          <p>Opcional. Sem promessas de lucro, recomendações de compra ou mensagens de WhatsApp. Você pode cancelar a qualquer momento.</p>
          <label style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer'}}>
            <input type="checkbox"
              checked={Boolean(snapshot.educationalEmail?.optedIn)}
              disabled={saving}
              onChange={(event)=>setEducationOptIn(event.target.checked)}/>
            {snapshot.educationalEmail?.optedIn?'Quero receber conteúdo educativo':'Aceito receber conteúdo educativo por e-mail'}
          </label>
          {!snapshot.educationalEmail?.deliveryEnabled &&
            <p><small>O envio automático ainda não está ativo. Sua preferência será registrada antes de habilitarmos os comunicados.</small></p>}
        </div>
      </>}
    </section>
  );
}
