# Nexa Wallet Connect — Homologação QA Brasil + Global

## Estado em 23/10/2026

**URL do teste:** https://nexa-walletconnect-qa-web.onrender.com

**API separada:** https://nexa-walletconnect-qa-api.onrender.com/health

Frontend: `HenriqueGuilhermeUx/nexa-react-app`, branch
`feat/nexa-walletconnect-br-global-isolated`.

Backend: `HenriqueGuilhermeUx/nexa-backend1`, branch
`feat/nexa-walletconnect-qa-api-v1`, startup **standalone**
`node scripts/wallet-connect-qa-api.cjs`. **Não** importa
`AppModule`, tesouraria, Auth de clientes ou serviços de execução financeira.
Não confundir com as rotas NestJS ainda não registradas no backend de produção.

Dados de QA: branch `br-soft-mode-b442ar6x` do Neon
`bold-breeze-67797797`, schema `nexa_wc_qa`, sem dados financeiros.
O teste automático com EOAs efêmeras passou (autenticação, replay, assinatura
incorreta, vinculação, listagem, revogação). Na sequência, foi desativada a
execução automática desse teste em cada restart.

## Como testar o conector no navegador

1. Abra o link QA acima em HTTPS no computador com MetaMask, Rabby,
   Coinbase Wallet Extension ou outra carteira EVM instalada; alternativamente,
   abra no navegador interno de uma carteira que injete `window.ethereum`.
2. Escolha **Brasil** ou **Global**. Ambos são contextos QA no mesmo backend
   isolado, **não são contas reais Nexa**.
3. No seletor, escolha a carteira detectada via **EIP-6963** ou `window.ethereum`.
   Clique **Conectar carteira**, autorize a leitura do endereço selecionado,
   e confirme a rede Polygon (chain ID 137) se solicitado.
4. Clique **Assinar mensagem e entrar no QA**. Leia a mensagem antes de
   assinar; ela deve citar `nexa-walletconnect-qa-web.onrender.com`,
   o endereço selecionado e explicitar que nenhuma transferência é autorizada.
   Uma sessão de teste temporária será criada no backend QA.
5. Para **vincular outra carteira**, escolha-a no seletor, conecte e clique
   **Assinar e vincular**. A API verifica assinatura EOA, desafio de uso único,
   endereço, chain ID, proprietário e conta QA. A lista será atualizada.
6. Use **Desvincular** para revogar o vínculo e confirmar que ele desapareceu
   da lista, sem movimentação financeira.

## Limites e proibições desta fase

- **Não envie USDC** ou qualquer criptoativo para testar o vínculo.
- A taxa Nexa prevista para entrada de USDC na Polygon é **0%**,
  mas o recebimento e o crédito de clientes **não estão ativados**.
- O browser QA atual **não depende da aplicação Privy de produção**
  e não carrega sua sessão financeira. IDs Privy de produção são
  inutilizados nas variáveis desse deploy.
- **WalletConnect por QR/rede móvel não é oferecido** neste modo EIP-6963.
  Exige configuração e aprovação separadas de um projeto WalletConnect/Reown
  ou um App Client Privy **de testes**.
- Este fluxo cobre carteiras **EOA** compatíveis com assinatura pessoal.
  Contratos EIP-1271, multisig e smart accounts precisam de fluxo próprio.
- Testes de navegador com carteiras reais são necessários antes de dizer
  que MetaMask, Rabby e extensões específicas passaram manualmente.
- Não foi feito merge em main, deploy de produção ou alteração da PR #172.
- Nenhuma assinatura libera `eth_sendTransaction`, `approve`, Pix,
  swaps, saques ou autorização automática de movimentação.

## Controles técnicos

A build QA usa `VITE_WALLET_CONNECT_LAB_ENABLED=true` e
`VITE_WALLET_CONNECT_QA_INJECTED=true`, desviando **antes** da montagem do
`PrivyProvider` e exibindo `QaInjectedWalletApp`.

O cliente fixa a única API autorizada em
`https://nexa-walletconnect-qa-api.onrender.com/api/v1`.
O frontend verifica o desafio canônico de login/vínculo antes de solicitar
`personal_sign`, revalida a conta ativa e a rede após a assinatura e mantém
o bearer JWT QA somente em memória (não em localStorage).

O backend exige:
- `NEXA_WALLET_CONNECT_QA_ONLY=ISOLATED_EOA_NONFINANCIAL_QA`
- `NODE_ENV=walletconnect_qa`
- `NEXA_FINANCIAL_EXECUTION_ENABLED=false`
- `DIRECT_SETTLEMENT_ENABLED=false`
- Origem HTTPS QA explicitamente permitida e base Neon isolada
- Desafio EIP-191/SIWE restrito ao host de homologação, nonce e expiração 5min
- Consumo transacional de uso único e vínculo único por endereço
- Sem credenciais de carteiras reais e sem leituras/escritas de ledger

## Testes

```bash
node scripts/wallet-connect-challenge.test.mjs
node scripts/wallet-connect-injected.test.mjs
node scripts/validate-wallet-connect-isolated.mjs
npm run check
```

Workflow: `.github/workflows/wallet-connect-web-isolated.yml`.

**Não confundir** esse QA utilizável para vínculo com a liberação
do Wallet Connect para clientes Nexa Brasil/Global: ainda são necessários
homologação com extensões reais, observação de depósito na Privy TEST,
reconciliação e aprovação operacional antes de qualquer ativação financeira.
