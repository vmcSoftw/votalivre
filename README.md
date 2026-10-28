# VotaLivre Secure 1.0.0-rc.1 — Homologação e confiança externa

> **Candidato à versão 1.0. Ainda NÃO homologado para eleições vinculantes.**

Esta versão continua o VotaLivre 0.9 e mantém: interface responsiva de voto, gestão de instituições e eleitores, controles de emissão, autenticação dos administradores, resultados para telões e auditoria da comissão.

## Novos recursos

- **Publicação protegida por âncoras externas**: a página de resultados exige correspondência entre a chave pública Ed25519 da lacração, a comissão fiscalizadora e as impressões digitais configuradas **antes da eleição**.
- **Fail closed**: ausência ou divergência de âncoras impede a divulgação da contagem, inclusive para o painel, CSV e APIs vinculadas.
- **Verificação offline** dos certificados da comissão e das assinaturas, com chaves previamente confiadas.
- **Confirmação de recibos somente depois da publicação autorizada**.
- **Painel limpa resultados antigos em caso de falha** de revalidação, evitando exibir números não mais verificáveis.
- **Pré-voo de configuração** para produção e novo relatório de homologação.
- **62 testes automatizados aprovados**, incluindo testes de substituição das chaves confiadas.

## Instalação para desenvolvimento

Requer Node.js 20.9+ e PostgreSQL. Utilize apenas banco de dados de teste e segredos próprios desse ambiente.

```bash
cp .env.example .env.local
npm install
npm test
npm run build
npm run dev
```

A URL local é `http://localhost:3000`. O `npm install` não foi concluído neste ambiente devido a erro DNS do registro npm, portanto **a compilação e o fluxo HTTP completo não foram validados**.

## Documentos importantes

- `docs/HOMOLOGACAO-v1.0.md`: resultados e limitações da homologação.
- `docs/ANCORAS-CONFIANCA-v1.0.md`: procedimento formal de fixação de chaves por eleição.
- `docs/GUIA-PAINEL-v0.9.md`: central de apuração e impressão de relatórios.
- `docs/GUIA-DA-COMISSAO-v0.8.md`: procedimento da comissão.
- `docs/SEGURANCA-E-LIMITES.md`: riscos existentes.

## Restrições de uso

Não há criptografia de ponta a ponta dos votos, proteção comprovada contra administrador privilegiado, bloqueio absoluto de screenshots ou certificação externa de segurança. **Não usar para eleições vinculantes até completar testes integrados e avaliação independente.**

## Cadastro no login (RC2)

A tela `/admin/login` possui **Criar conta com convite**, levando à página `/admin/cadastro`. Cada convite permite criar uma nova organização com gestor proprietário e exige confirmação do MFA. Para bancos antigos, aplique `sql/migrate_1_0_signup.sql`; para bancos novos, `sql/schema.sql`. Gere convites via `node --env-file=.env.local scripts/create-registration-invite.mjs`. **Detalhes:** `docs/CADASTRO-ADMIN-v1.0-RC2.md`. Não é cadastro público irrestrito.
