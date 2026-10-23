# Nexa Wallet Connect — QA separado de produção

## O que esta branch entrega

Branch `feat/nexa-walletconnect-br-global-isolated` do portal React Nexa.
A interface permite abrir o seletor Privy para carteiras externas, escolher
a carteira, alternar entre os mercados **BR** e **GLOBAL**, solicitar um
desafio com validade de cinco minutos, assinar localmente com `personal_sign`,
confirmar o vínculo da carteira EOA e listar ou remover o vínculo.

**Não é uma integração de liquidação.** Não transmite transações, não solicita
aprovações ERC-20, não credita o ledger e não acessa as chaves privadas.
A taxa Nexa para entrada futura de USDC nativo Polygon continua **0%**.

## Pré-condições para um teste ponta a ponta verdadeiro

1. Criar ou usar um serviço **Nest de homologação separado** do serviço financeiro
   `nexa-backend-p2u0.onrender.com`, com banco e JWT isolados, schema SQL
   `docs/sql/review_only_external_wallet_binding.sql` revisto/instalado
   e o módulo `ExternalWalletInboundLabModule` importado somente nesse Nest.
   O serviço `nexa-wallet-inbound-readonly-lab` atual **não** atende essas rotas;
   ele responde somente a `GET /health`. Nunca reutilizar credenciais
   de clientes ou banco de produção nesse ambiente.
2. Servir um build desta branch num domínio **QA separado e protegido**.
   Configurar o App Client Web no Privy para autorizar exatamente a origem
   HTTPS desse QA e habilitar os conectores EVM externos/WalletConnect
   disponíveis na aplicação de teste. O seletor QR depende da configuração
   do provedor, não apenas de renderizar um botão.
3. Usar a aplicação Privy de homologação e sua chave pública App ID no QA.
   Nunca colocar App Secret, seed phrase ou credenciais na build web.
4. Testar com um usuário **de homologação** que exista tanto no login Nexa
   staging quanto no login Privy staging com o **mesmo e-mail**.

## Variáveis do frontend QA (não usar produção)

```env
VITE_API_URL=https://SEU-BACKEND-STAGING.example/api/v1
VITE_PRIVY_APP_ID=APP_ID_PUBLICO_PRIVY_STAGING
VITE_PRIVY_CLIENT_ID=CLIENT_ID_WEB_STAGING
VITE_WALLET_CONNECT_LAB_ENABLED=true
VITE_WALLET_CONNECT_LAB_API_URL=https://SEU-BACKEND-STAGING.example/api/v1
```

Sem `VITE_WALLET_CONNECT_LAB_ENABLED=true`, a seção não aparece.
Sem a API staging válida ou se a URL for o backend financeiro de produção,
o vínculo é bloqueado antes de enviar o JWT da sessão.

## Contratos HTTP esperados no ambiente staging

Todos com `Authorization: Bearer <JWT de usuário Nexa staging>`:

- `POST /api/v1/wallet-connect-inbound/ownership/challenge`
  com `{walletAddress,market:"BR"|"GLOBAL"}`;
  resposta `{challengeId,message,expiresAt,chainId:137}`
- `POST /api/v1/wallet-connect-inbound/ownership/verify`
  com `{challengeId,signature,market}`;
  resposta `{bound:true,chainId:137,address}`
- `GET /api/v1/wallet-connect-inbound/ownership/links`
  com resposta `{wallets:[...]}`
- `DELETE /api/v1/wallet-connect-inbound/ownership/link`
  com body `{walletAddress}` e resposta `{revoked:true,...}`

A assinatura inclui domínio/origem e nonce criados pelo servidor, nunca uma
mensagem de autorização financeira. A API deve aplicar autenticação, rate
limit, uso único, expiração do desafio e isolamento entre usuários/mercados.

## Checklist final para liberar BR e GLOBAL

- Usuário staging autenticado e e-mail Privy correspondente
- MetaMask/Rabby conectando via extensão
- Coinbase/Trust via conector oferecido pelo Privy no dispositivo ou QR
- Assinatura válida aceita pelo Nest staging, rejeitando replay e outros usuários
- Carteiras listadas somente para usuário titular e desvinculadas corretamente
- Redes incorretas, contas diferentes, sessão expirada e rejeição de assinatura
  apresentam erros sem alterar ledger
- Recebimento USDC nativo Polygon com `0%` taxa Nexa homologado **separadamente**,
  e prova real de depósito autorizada à wallet isolada; mínimo de 20 confirmações
- Aprovação explícita posterior antes de qualquer ativação da produção

## Comandos

```bash
node scripts/validate-wallet-connect-isolated.mjs
npm run validate:contract
npm run build
```

A workflow `wallet-connect-web-isolated.yml` executa esses checks na branch.
A publicação desta branch **não** foi feita no site/app dos clientes.
