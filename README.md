# Nexa Web + Privy

Portal web React/Vite da Nexa com login Nexa, identidade Privy por e-mail e embedded wallet individual.

## Fluxo

1. O cliente entra ou se cadastra com a conta Nexa.
2. O portal consulta `/direct-settlement/profile`.
3. Usuários `legacy_beta` continuam no fluxo anterior, sem migração automática.
4. Usuários `direct_settlement` sem wallet confirmam o mesmo e-mail por OTP Privy.
5. O portal cria somente a embedded wallet do usuário autenticado.
6. O vínculo usa:
   - `Authorization: Bearer <JWT Nexa>`
   - `x-privy-access-token: Bearer <token Privy>`
   - body apenas com `privyWalletId` e `walletAddress`.
7. O backend deriva o Privy User ID do token verificado e executa a auditoria.

## Variáveis públicas

```env
VITE_API_URL=https://nexa-backend-p2u0.onrender.com/api/v1
VITE_PRIVY_APP_ID=cmpen2gm3007v0cjswjlyefji
VITE_PRIVY_CLIENT_ID=client-...
VITE_BASE_PATH=/
```

Nunca configure no frontend:

- `PRIVY_APP_SECRET`
- `PRIVY_SECRET_KEY`
- private key
- seed phrase

## Privy Dashboard

Crie um App Client separado do tipo Web, usando o mesmo App ID do mobile.

Origens permitidas de produção:

```text
https://trynexa.com.br
https://www.trynexa.com.br
```

Durante homologação, acrescente somente a URL exata do deploy Netlify de QA.

## Build

```bash
npm install --no-audit --no-fund
npm run check
```

O Netlify usa Node `20.19.4`, publica `dist` e preserva as rotas existentes de `/admin`, `/api/v1/*` e `/docs`.

## Travas operacionais

O portal não liga execução financeira nem movimenta Pix/USDC por conta própria. A disponibilidade depende do perfil do backend, da auditoria de wallet, das flags e da conciliação operacional.
