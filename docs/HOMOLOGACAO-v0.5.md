# Plano e resultados de homologação — VotaLivre Secure v0.5

## Escopo

Eleição de demonstração, exclusivamente com dados fictícios. **NÃO** usar dados pessoais de menores/eleitores reais nos ensaios. A análise não equivale a certificação de segurança nem demonstra sigilo extremo contra administrador privilegiado.

### Resultado confirmado em PostgreSQL Neon real (2026-10-28)

- Projeto isolado de testes: `votalivre-homologacao-2026` (ID: `fragrant-breeze-92535958`, aws-us-east-1). Nenhum banco preexistente do usuário foi alterado.
- Foram criadas tabelas de teste equivalentes aos principais componentes de eleição, credencial, voto e recibo, com teste de gatilho de uso único.
- Uma credencial fictícia foi submetida a **12 solicitações SQL concorrentes** para consumo atômico, gravação de voto e recibo. **1** gravou todos os três registros e **11** retornaram zero registros gravados.
- A operação foi validada no **nível do banco SQL**, não através da aplicação Next.js nem do fluxo HTTP completo.
- Este teste cobre apenas a propriedade de consumo único e inserções coerentes no caso testado. Não estabelece resistência a todos os cenários de corrida ou fraude.

### Testes adicionais integrados (para executar no ambiente de homologação)

O script `scripts/homologacao-postgresql.mjs` prepara os registros de teste em um banco dedicado e exercita a mesma estratégia de atualização condicional e inserção transacional adotada na rota de voto, incluindo 30 tentativas de um token, votos de tokens diferentes, tentativas duplicadas, rollback e isolamento entre eleições. Não usa eleitores reais.

**Prérequisitos:** PostgreSQL de homologação isolado com o `sql/schema.sql` carregado; dependências instaladas; `TEST_DATABASE_URL` preenchida somente por variável de ambiente segura. A variável `VOTALIVRE_HOMOLOGATION=YES` é obrigatória. Execute `npm run test:db`. Os dados fictícios permanecem no banco para exame; não execute em produção.

### Evidências ainda pendentes

- `npm install` e `next build`: indisponíveis aqui por erro de resolução de DNS para `registry.npmjs.org` (`EAI_AGAIN`). Nenhum build completo foi realizado.
- Execução do script integrado `test:db` contra a instância com o esquema integral; houve apenas a prova SQL isolada descrita acima.
- Testes HTTP completos (cadastro, autenticação MFA, votação, pré-encerramento, lacração, auditoria offline) e inspeção visual em dispositivos reais.
- Revisão de código independente, análise de dependências com lockfile atualizado, testes de carga, falhas de rede, coerção e confidencialidade diante de administradores.

### Critérios para liberar uma eleição real

1. Dependências imutáveis, lockfile auditado e build de produção reproduzível.
2. Ambiente separado com chave de criptografia em cofre seguro e gestão de acesso mínimo.
3. Validação de chave pública e lacração por comissão independente.
4. Testes E2E, pen-test independente e plano operacional de resposta a incidentes.
5. Política de privacidade, retenção e avaliação LGPD, sobretudo para menores.
6. Plano de contingência para eleitores sem acesso ao celular ou internet.
7. Tratar prints como risco residual: navegadores não conseguem garantir bloqueio completo e um segundo dispositivo pode fotografar a tela.

Até essas etapas estarem concluídas, **não usar para eleições com efeitos jurídicos ou administrativos relevantes**.
