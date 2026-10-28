# Relatório de homologação — VotaLivre Secure 1.0.0-rc.1

**Data:** 28/10/2026  
**Classificação:** candidato à versão 1.0, **não homologado para eleições vinculantes**.

## Escopo das alterações

1. **Falha fechada na publicação**: mesmo após o encerramento, lacração e endossos, o painel não publica resultados sem duas âncoras preestabelecidas e específicas da eleição.
2. **Chave da lacração e lista da comissão fixadas**: a impressão SHA-256 da chave pública Ed25519 (DER/SPKI) e a impressão canônica da lista de fiscais são verificadas antes dos endossos.
3. **Verificador offline**: confere manifesto, assinatura, certificado, quórum e impressões digitais, independentemente do front-end.
4. **Confirmação de recibo protegida**: somente disponível após aprovação e verificação das mesmas âncoras exigidas pelo painel.
5. **Interface de apuração sem dados obsoletos**: diante de falha na revalidação, remove números anteriores da tela e exibe o erro.
6. **Pré-voo de configuração**: valida presença e formato dos segredos, HTTPS e configuração do mapa das âncoras, sem exibir valores secretos.

## Evidências testadas neste ambiente

| Teste | Resultado |
|---|---|
| Testes automatizados Node, incluindo os 48 herdados e 14 novos | **62/62 aprovados** |
| Assinaturas substituídas e lista de comissão trocada | Rejeitadas em testes unitários |
| Manifesto divergente do certificado | Rejeitado em testes unitários |
| Documento sem âncoras externas | Resultados ocultos em testes unitários |
| Segurança da exportação CSV, apuração e lógica de publicação anteriores | Testes herdados aprovados |
| Integração real pelo Next.js, navegador e HTTP | **Não executada** |
| `npm install` | **Falhou com EAI_AGAIN / DNS do registry.npmjs.org** |
| Build de produção `next build` | **Não executado** (dependências indisponíveis) |
| Teste PostgreSQL da versão 1.0 (migração e interface) | **Não executado**; não há alteração de esquema nesta versão |
| Pentest externo e revisão criptográfica por especialistas | **Não realizados** |
| Sistema Android nativo / bloqueio de screenshots | **Não implementado** |

## Limitações que impedem homologação para eleições vinculantes

- O dispositivo do eleitor pode estar comprometido; o sistema não comprova que a escolha exibida foi a cifrada.
- O servidor pode acessar chaves de descriptografia e comprometer a confidencialidade, especialmente frente a um operador privilegiado.
- O uso de um código adicional não comprova, sozinho, identidade pessoal do eleitor nem impede coação.
- O mapa de âncoras está na configuração do servidor e pode ser modificado por quem tiver privilégios suficientes: **a comissão deve publicar, custodiar e conferir externamente as impressões antes da eleição**. O verificador offline permite detectar divergência frente à cópia externa.
- O certificado de fiscais é uma declaração assinada, não prova de votação verificável de ponta a ponta.
- A exportação atual em PDF usa impressão do navegador, sem geração PDF certificada.
- Bloqueio absoluto de capturas de tela não é possível na Web.

## Roteiro de aceitação antes de produção

1. Restaurar a base de dados de homologação a partir de backup e testar migrações em ambiente descartável.
2. Instalar dependências de versões conferidas, executar `npm test` e `npm run build` sem falhas.
3. Publicar ambiente privado de testes, confirmar TLS e executar testes HTTP de cadastro, votação, lacração, comissão, recibos e publicação.
4. Simular 100+ eleitores e tentativas repetidas e simultâneas, concorrência, perda de rede, retry de clientes e recuperação de falhas.
5. Confirmar isolamento multi-institucional e controle de acesso em todas as rotas, inclusive exportações e IDs arbitrários.
6. Conferir credenciais por dois responsáveis, testes de revogação e registros administrativos.
7. Publicar âncoras fora do servidor **antes** do início da votação. Testar recusa de publicações com chaves trocadas.
8. Enviar os pacotes de auditoria a dois fiscais em máquinas independentes. Conferir as assinaturas offline.
9. Contratar auditoria externa e realizar testes de invasão supervisionados.
10. Fazer análise de LGPD para instituições com menores de idade, plano de incidentes, retenção e acessibilidade.

## Comandos

```bash
npm test
npm run trust:pin -- comissao.json lacracao-publica.pem
npm run preflight:production
npm run audit:publication -- auditoria.json comissao.json ancoras.json
```

**Não execute a migração do banco de uma versão antiga diretamente em produção nem utilize dados reais de menores de idade durante a homologação.**
