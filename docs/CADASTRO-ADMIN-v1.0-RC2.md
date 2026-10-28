# Cadastro institucional via tela de acesso — VotaLivre 1.0 RC2

## O que foi adicionado
- `/admin/login`: link **Criar conta com convite**.
- `/admin/cadastro`: formulário para uma NOVA organização (nome, e-mail, senha de pelo menos 16 caracteres e convite).
- `/api/admin/register`: cria organização e conta de proprietário **inativa**. Consome convite em transação atômica.
- `/api/admin/register/confirm`: só ativa após conferência TOTP do aplicativo autenticador, em até 15 minutos.
- `npm run registration:invite`: cria convite aleatório, **de uso único**, válido por 24 horas.
- Segredos e convites jamais devem ser armazenados no GitHub ou enviados em mensagens abertas.

## Preparar banco (obrigatório)

**Instalação nova:** execute `sql/schema.sql` em banco vazio. As novas tabelas já estão incluídas.

**Banco anterior v1.0:** execute somente `sql/migrate_1_0_signup.sql`, preservando as tabelas existentes.

## Criar convite e realizar cadastro

1. Na pasta interna do projeto: `npm install`.
2. Configure `.env.local` (não versionado): `DATABASE_URL`, `APP_ORIGIN`, `LOGIN_RATE_SECRET`, `MFA_ENCRYPTION_KEY` e demais chaves da aplicação.
3. No Windows PowerShell: `node --env-file=.env.local scripts/create-registration-invite.mjs`.
4. O terminal mostrará **um único convite de 64 caracteres**, válido por 24 horas; entregue de modo privado à pessoa autorizada.
5. Abra `http://localhost:3000/admin/login` → **Criar conta com convite**. Preencha os campos.
6. Na segunda etapa, importe a chave exibida no Google Authenticator/Microsoft Authenticator. Confirme o código MFA em até 15 minutos, sem fechar a página.
7. Guarde o `organizationId`. Na tela `/admin/login`, informe o ID, e-mail, senha e TOTP.

## Segurança e limitações

- Convites são armazenados somente pelo SHA-256; gerados com 256 bits aleatórios.
- Apenas convite válido autoriza uma conta **proprietária de uma nova organização**; não permite acesso a organizações anteriores.
- Não foi implementado cadastro público irrestrito de administradores, nem verificação de titularidade do e-mail. O convite tem de ser distribuído e controlado pelo operador do sistema.
- Se a configuração MFA for interrompida/expirar, a conta permanece inativa e o convite não pode ser reutilizado. O operador deve invalidar a tentativa pendente no banco e emitir outro convite; não tente fazer isso em produção sem um procedimento auditado.
- O limite de solicitações vale por origem confiável na Vercel; configurar WAF para implantação em outras infraestruturas.
- Antes do uso real: HTTPS, validação de e-mail, testes integrados com Postgres, revisão de permissões, fluxos de recuperação MFA e auditoria externa continuam necessários.
- Para gestores da **mesma organização**, mantenha a inclusão autorizada pelo proprietário (`scripts/add-manager.mjs`), não use um novo cadastro de organização.
