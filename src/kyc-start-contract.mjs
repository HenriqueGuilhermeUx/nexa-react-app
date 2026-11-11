// Pure contract used by the authenticated Nexa onboarding UI.
// No browser globals, provider secrets, or automatic financial actions.
const approved = value => String(value || '').trim().toLowerCase() === 'approved';

export function trustedDiditUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' ||
      !(host === 'didit.me' || host.endsWith('.didit.me') ||
        host === 'didit.io' || host.endsWith('.didit.io')) ||
      url.username || url.password || (url.port && url.port !== '443'))
      return null;
    return url.href;
  } catch { return null; }
}

function apiError(response) {
  if (response.status === 401) return 'Sua sessão expirou. Entre novamente na Nexa.';
  if (response.status === 403) return 'Sua conta não pode acessar este recurso no momento.';
  return 'Não foi possível iniciar a verificação agora. Tente novamente ou procure o suporte.';
}

export async function prepareBrazilDiditStart({
  accessToken, apiBaseUrl, consent, fetchImpl,
}={}) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Entre novamente na Nexa para continuar.');
  }
  if (consent !== true) {
    throw new Error('Confirme o consentimento explícito antes de iniciar.');
  }
  if (typeof fetchImpl !== 'function') throw new Error('Verificação temporariamente indisponível.');
  // Only allow the application's configured HTTPS API origin/path; no token
  // ever leaves that trusted origin or reaches the Didit URL.
  const apiUrl = new URL(String(apiBaseUrl || ''));
  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password ||
      apiUrl.search || apiUrl.hash ||
      !/^(?:nexa-backend-p2u0\.onrender\.com|[a-z0-9-]+\.trynexa\.com\.br)$/i.test(apiUrl.hostname) ||
      apiUrl.pathname.replace(/\/$/,'') !== '/api/v1') {
    throw new Error('A configuração da API Nexa não é válida.');
  }
  const base = apiUrl.href.replace(/\/$/,'');
  const headers = {Authorization: 'Bearer ' + accessToken, Accept:'application/json'};
  const meRes = await fetchImpl(base+'/user/me',{headers,cache:'no-store'});
  if (!meRes.ok) throw new Error(apiError(meRes));
  const me = await meRes.json();
  if (!me?.id || String(me.residenceCountry || 'BR').toUpperCase() !== 'BR') {
    throw new Error('Este fluxo é exclusivo para contas brasileiras confirmadas. Procure o suporte.');
  }
  const currentRes = await fetchImpl(base+'/kyc/didit/me',{headers,cache:'no-store'});
  if (!currentRes.ok) throw new Error(apiError(currentRes));
  const current = await currentRes.json();
  if (!current?.success || current.provider !== 'didit') {
    throw new Error('Não foi possível confirmar a situação da Didit. Tente novamente.');
  }
  if (approved(current.kycStatus)) {
    return {kind:'approved',message:'Sua verificação já foi aprovada.'};
  }
  if (current.manualReviewRequired === true || String(current.kycStatus).toLowerCase()==='in_review') {
    return {kind:'manual_review',message:'Existe uma revisão pendente. Procure a equipe Nexa para orientação.'};
  }
  const existing = trustedDiditUrl(current.verificationUrl);
  const currentStatus = String(current.diditSessionStatus || '').toLowerCase();
  if (existing && !/(expired|failed|cancelled|canceled|rejected|completed)/.test(currentStatus)) {
    return {kind:'redirect',url:existing,reused:true};
  }
  const startRes = await fetchImpl(base+'/kyc/didit/brazil/start',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({consent:true}),
  });
  const result=await startRes.json().catch(()=>({}));
  if (!startRes.ok) throw new Error(apiError(startRes));
  if (result.alreadyApproved || approved(result.kycStatus)) {
    return {kind:'approved',message:'Sua identidade já está aprovada.'};
  }
  if (result.manualReviewRequired) {
    return {kind:'manual_review',message:'Seu caso precisa de revisão humana antes de outra tentativa.'};
  }
  const url=trustedDiditUrl(result.verificationUrl);
  if (!url) throw new Error('A Didit não retornou um link oficial reconhecido. Procure o suporte.');
  return {kind:'redirect',url,reused:Boolean(result.reusedSession)};
}
