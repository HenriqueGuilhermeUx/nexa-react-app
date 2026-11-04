# Nexa Premium Agentics — rollout da interface (somente leitura)

## Escopo
Branch isolada `feat/nexa-premium-agentics-readonly-20261101`.
A interface aparece no Dashboard apenas se
`VITE_NEXA_AGENTICS_PREVIEW_ENABLED=true` no build. O padrão é **desligado**.
A variável pública é apenas um controle de visibilidade, **não autorização**.

## Dependências para ativar
1. API da PR #185 (`nexa-backend1`) publicada e validada na mesma origem
   configurada em `VITE_API_URL`.
2. `GET /api/v1/agentic/accounts/availability` deve confirmar acesso ao
   usuário autenticado Premium, sem ler saldos.
3. `GET /api/v1/agentic/consultant-review/my-finances` deve exigir JWT,
   autorização Premium, consentimento válido e retornar somente leitura.
4. Consentimento persistente, individual, revogável e auditável no servidor,
   com revogação efetiva antes da próxima leitura. A allowlist em variável
   de ambiente **não** substitui esse requisito.
5. Teste E2E de login, logout, troca de usuário, 401, 403, expiração,
   ausência de consentimento, fontes indisponíveis e relatório sem dados
   consolidados indevidamente. Sem operações reais.
6. Revisão do build da branch e deploy de prévia isolada antes de merge.

## Rollback
Desativar `VITE_NEXA_AGENTICS_PREVIEW_ENABLED` e reconstruir o frontend;
desativar também as flags de leitura no backend se necessário. Nunca
habilitar `NEXA_AGENTIC_FINANCIAL_EXECUTION_ENABLED` nem settlement para
este lançamento. Não alterar fluxos Privy, PIX ou wallet existentes.

## Situação
Componente e integração no Dashboard implementados na branch.
Build, E2E, consentimento persistente e deploy **não confirmados**.
