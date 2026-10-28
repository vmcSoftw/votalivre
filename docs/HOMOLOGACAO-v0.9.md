# Relatório de validação — VotaLivre Secure 0.9

Data: 28/10/2026. **Uso somente em homologação com dados fictícios.**

## Escopo implementado

- Central responsiva para TVs/projetores, computadores e celulares.
- Atualização automática em 30 s, botão manual e aviso de falhas de rede.
- Apuração por candidatos/chapas, totais válidos, brancos, nulos, participação/abstenção quando disponível, quórum e empate.
- Acesso público bloqueado antes da conclusão documental: encerramento + assinatura do manifesto + certificado da comissão com número mínimo de endossos.
- JSON com projeção mínima, sem voto individual, IP, identificação do eleitor, credenciais ou recibos.
- Exportação CSV após publicação; arquivo impresso em PDF por meio do navegador, sem nova dependência.
- Rotas antigas de apuração e auditoria submetidas ao mesmo bloqueio.

## Riscos e limitações

1. **Validação da confiança:** as chaves de assinatura continuam vindas da própria base de dados; sua legitimidade requer cópia confiada por canal externo. Criptografia não é sinônimo de eleição legítima.
2. **Sigilo:** a aplicação continua tendo acesso à chave de decifragem da cédula; a proteção contra operadores privilegiados ainda não foi resolvida.
3. **Carga:** polling público de 30 s exige cache, testes de performance, rate limit e observabilidade em escala.
4. **Entrega do PDF:** relatório é impresso no navegador. Não há arquivo PDF assinado digitalmente gerado pelo servidor.
5. **Sem E2E:** compilação, instalação de dependências, testes HTTP, acessibilidade com leitores de tela, segurança e ensaio de carga permanecem pendentes até serem efetivamente realizados.
6. **Sem migração:** versão utiliza tabelas de 0.8, evitando alterações no banco operacional.

## Como verificar

```bash
npm install
npm test
npm run build
# Em banco descartável (ver 0.8): criar eleição de teste, abrir, votar, lacrar, obter endossos e comparar hash.
```

Não utilizar em eleição vinculante ou que envolva consequências trabalhistas até avaliação independente da segurança e do processo de votação.

## Testes efetivamente executados nesta entrega

- `node --test tests/*.test.mjs`: **48/48 aprovados** (36 herdados, 12 da v0.9).
- Parser TypeScript em modo JSX: **70 arquivos JavaScript/JSX/MJS sem erros sintáticos**.
- `npm install --ignore-scripts --no-audit --no-fund`: **incompleto**, erro DNS `EAI_AGAIN` ao acessar `registry.npmjs.org`.
- O `npm run build` e os testes HTTP completos não puderam ser executados sem as dependências.
- Prévia HTML autônoma gerada. Chromium headless não conseguiu produzir uma captura neste ambiente; o HTML não foi testado em navegador real.
- PDF demonstrativo gerado com ReportLab, renderizado em imagem e inspecionado visualmente, sem problemas de paginação ou corte.

**Observação:** o PDF demonstrativo é um arquivo de exemplo criado fora da aplicação. Na interface efetiva, o PDF será obtido pela função `Imprimir / salvar PDF` do navegador.
