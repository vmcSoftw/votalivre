# Relatório de desenvolvimento e homologação parcial — v0.6

**Data:** 28/10/2026  
**Escopo:** código de votação institucional (Next.js/PostgreSQL); nenhuma eleição real conduzida.

## Alterações implementadas

| Domínio | Evidência de código | Estado |
|---|---|---|
| Distribuição por dois gestores | `app/api/admin/elections/[id]/tokens/route.js` e `pins/route.js` | Implementado, sem integração HTTP validada |
| Cancelamento de lotes | `revoke/route.js` e coluna `revoked_at` | Implementado, sem E2E validado |
| PIN cifrado temporário | `lib/issuance.js` com AES-256-GCM e AAD | Unitário aprovado |
| Controle global de origem | `lib/limits.js` + `request_rate_limits` | Código implementado, sem E2E validado |
| Limite por credencial existente | `app/api/vote/route.js` | Revisado, sem E2E validado |
| Segundo gestor com MFA | `scripts/add-manager.mjs` | Código verificado, sem execução em conta real |
| UI de lotes e códigos | `components/AdminPanel.js` | Implementada, build React não validado |

## Testes realizados

1. **19 de 19 testes unitários passaram**: criptografia de votos, TOTP, senhas, recibos, manifesto, soma de votos e, na v0.6, cifra/autenticidade do lote, AAD, HMAC de origem e tratamento de cabeçalho não confiável.
2. **20 tentativas SQL concorrentes** feitas no projeto de homologação Neon `votalivre-homologacao-2026`, dentro de objetos exclusivos de QA `v06_qa`: uma credencial fictícia gerou exatamente um registro, e 19 tentativas foram incapazes de registrar um segundo voto.
3. **Verificação de sintaxe JavaScript** dos arquivos sem JSX realizada via Node. **A sintaxe React/JSX não foi compilada**, porque dependências Next.js não estão instaladas.
4. Tentativa `npm install --ignore-scripts --no-audit --no-fund`: falhou em `https://registry.npmjs.org/next` com erro DNS `EAI_AGAIN`. Consequentemente não existe build de produção, lockfile revisado nem execução end-to-end.

## Critérios ainda pendentes

- Criar banco **novo** com todo o esquema v0.6 e testar APIs em HTTP, autenticação de dois gestores e concorrência real na rota `POST /api/vote`.
- Ensaiar o caso “resposta de PIN perdida”, revogação de lote e recuperação com nova emissão.
- Realizar testes com dezenas de milhares de eleitores fictícios, indisponibilidade parcial de rede e picos simultâneos, calibrando os limites.
- Adicionar roles de banco com privilégio mínimo, serviço de segredos e gerenciamento de chaves da comissão separado do servidor de votação.
- Ensaios SAST/DAST, pentest externo, WCAG, LGPD, logs de incidentes sem correlacionar identidade e escolha, backup/restore.
- Segurança contra coação, capturas de tela e administradores privilegiados permanece **não comprovada**.

**Parecer:** versão para desenvolvimento/homologação controlada. **Não está liberada para eleições juridicamente vinculantes.**
