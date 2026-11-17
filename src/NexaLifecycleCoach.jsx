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
          <strong>Conteúdo educativo: escolha a frequência</strong>
          <p>Opcional e revogável. Informações gerais sobre segurança e cripto, sem recomendação individual. O boletim diário ainda não é disparado.</p>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency" checked={!snapshot.educationalEmail?.optedIn}
              disabled={saving} onChange={()=>setEducationOptIn(false,'weekly')}/>
            Não receber e-mails educativos
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency"
              checked={Boolean(snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency !== 'daily')}
              disabled={saving} onChange={()=>setEducationOptIn(true,'weekly')}/>
            Orientações semanais (disponíveis)
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="radio" name="nexa-education-frequency"
              checked={Boolean(snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency === 'daily')}
              disabled={saving} onChange={()=>setEducationOptIn(true,'daily')}/>
            Boletim diário (registrar interesse; envios ainda desligados)
          </label>
          {snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency === 'daily' &&
            <p><small>Interesse diário registrado. Esta escolha substitui a preferência semanal e não inicia mensagens enquanto o envio diário não estiver habilitado.</small></p>}
          {snapshot.educationalEmail?.optedIn && snapshot.educationalEmail?.frequency !== 'daily' && !snapshot.educationalEmail?.deliveryEnabled &&
            <p><small>O envio semanal ainda não está disponível. Sua escolha foi registrada.</small></p>}
        </div>
      </>}
    </section>
  );
}
