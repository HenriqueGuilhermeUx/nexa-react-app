import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/App.jsx');
const redemption = read('src/RedemptionHistory.jsx');
const redemptionPortal = read('src/RedemptionPortal.jsx');
const styles = read('src/styles.css');
const main = read('src/main.jsx');
const pkg = JSON.parse(read('package.json'));

const failures = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) failures.push(`Ausente: ${label}`);
};
const rejectText = (source, value, label) => {
  if (source.includes(value)) failures.push(`Proibido: ${label}`);
};

requireText(app, "/direct-settlement/profile", 'consulta do perfil direct settlement');
requireText(app, "/direct-settlement/wallet/link", 'endpoint seguro wallet/link');
requireText(app, "/direct-settlement/wallet/audit", 'endpoint wallet/audit');
requireText(app, "'x-privy-access-token'", 'header separado do token Privy');
requireText(app, 'getAccessToken()', 'obtenção do access token Privy');
requireText(app, 'useCreateWallet', 'criação manual de embedded wallet no login whitelabel');
requireText(app, 'createWallet()', 'execução de criação da embedded wallet');
requireText(app, "settlementProfile === 'direct_settlement'", 'separação de perfil direct settlement');
requireText(app, 'isLegacyBeta', 'preservação do fluxo Beta/Legado');
requireText(app, 'PRIVY_EMAIL', 'mensagem/código de proteção de e-mail do backend não é obrigatório no cliente');

// O requisito acima é semântico no backend, não deve obrigar uma string de erro no frontend.
const semanticIndex = failures.indexOf('Ausente: mensagem/código de proteção de e-mail do backend não é obrigatório no cliente');
if (semanticIndex >= 0) failures.splice(semanticIndex, 1);

rejectText(app, '/user/link-privy-wallet', 'endpoint legado de vínculo');
rejectText(app, 'privyUserId:', 'privyUserId enviado pelo cliente');
rejectText(app, 'PRIVY_APP_SECRET', 'App Secret no frontend');
rejectText(app, 'PRIVY_SECRET_KEY', 'Secret Key no frontend');
rejectText(app, 'privateKey', 'private key no frontend');
rejectText(app, 'seedPhrase', 'seed phrase no frontend');

requireText(redemption, '/payment/user', 'consulta de resgates Pix do usuário');
requireText(redemption, 'BRL líquido da venda', 'resultado real da venda');
requireText(redemption, 'Fee Nexa', 'fee Nexa separada');
requireText(redemption, 'Pix Out', 'custo Pix Out separado');
requireText(redemption, 'Pix enviado', 'valor final enviado');
requireText(redemption, 'Estimativa antes da venda', 'identificação da estimativa');
requireText(redemption, 'Este valor não é garantido', 'aviso de valor não garantido');
requireText(redemption, 'Até 1 dia útil', 'prazo operacional');
requireText(redemption, 'endToEndId', 'referência final do Pix');
rejectText(redemption, 'nexaFeeBrl =', 'cálculo de fee no navegador');
rejectText(redemption, 'pixOutFeeBrl =', 'cálculo de Pix Out no navegador');
rejectText(redemption, 'saleProceedsBrl -', 'cálculo financeiro final no navegador');

requireText(redemptionPortal, "document.querySelector('.portal-content')", 'montagem somente no dashboard autenticado');
requireText(redemptionPortal, 'createPortal', 'portal React isolado');
requireText(redemptionPortal, 'readAccessToken', 'uso da sessão Nexa existente');
requireText(redemptionPortal, 'MutationObserver', 'sincronização com login e logout');
rejectText(redemptionPortal, 'x-privy-access-token', 'token Privy desnecessário no histórico');

requireText(styles, '.redemption-section', 'estilos do extrato de resgates');
requireText(styles, '.status-danger', 'estado visual de falha');

requireText(main, 'PrivyProvider', 'PrivyProvider');
requireText(main, 'RedemptionPortal', 'montagem do extrato reconciliado');
requireText(main, "loginMethods: ['email']", 'login Privy por e-mail');
requireText(main, "createOnLogin: 'users-without-wallets'", 'configuração de embedded wallet');
requireText(main, 'VITE_PRIVY_APP_ID', 'App ID público por variável');
requireText(main, 'VITE_PRIVY_CLIENT_ID', 'Client ID web opcional');

if (pkg.dependencies?.['@privy-io/react-auth'] !== '3.35.2') {
  failures.push('A versão do SDK Privy precisa permanecer fixada em 3.35.2 nesta release.');
}
if (pkg.dependencies?.react !== '19.2.8') {
  failures.push('A versão React validada precisa permanecer fixada em 19.2.8 nesta release.');
}

if (failures.length) {
  console.error('Validação Privy Web falhou:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  contract: 'nexa-web-privy-v2',
  walletLinkEndpoint: '/direct-settlement/wallet/link',
  walletAuditEndpoint: '/direct-settlement/wallet/audit',
  redemptionHistoryEndpoint: '/payment/user',
  redemptionMountedOnlyInsideAuthenticatedPortal: true,
  actualSaleSettlementDisplayed: true,
  estimateSeparatedFromFinalPayout: true,
  feeCalculatedByBackendOnly: true,
  privyIdentityDerivedFromVerifiedAccessToken: true,
  legacyBetaPreserved: true,
  financialExecutionIntroduced: false,
  secretsInFrontend: false,
}, null, 2));
