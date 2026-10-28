# Homologação e mudanças — VotaLivre Secure 0.7 (28/10/2026)

## Módulos novos

1. **Instituições:** perfil de escola, empresa, associação ou outra instituição. Somente `owner` pode mudar nome e categoria. O nome antigo das eleições fica preservado para histórico.
2. **Equipe:** o `owner` consulta gestores e fiscais, muda a função de manager/auditor, desativa e reativa contas sem alterar sua própria conta. Uma conta `owner` não pode ser editada pela tela. Novas contas exigem `npm run admin:add` com credencial MFA própria.
3. **Aptos a votar:** importação de arquivos CSV `identificador;nome`; validação por lote, remoção de duplicados intra-lote, rejeição de duplicados já cadastrados, nome AES-256-GCM e HMAC-SHA256 do identificador. A lista é congelada assim que houver qualquer credencial emitida ou a votação começar. Nenhum cadastro contém escolha, credencial ou recibo. O próprio gestor não sabe em quem votou o eleitor.
4. **Credenciais limitadas:** quando há lista de aptos, a emissão é bloqueada se ultrapassaria a quantidade cadastrada. Isso NÃO prova que uma credencial foi entregue à pessoa certa; a conferência externa é obrigatória.
5. **Eleições configuráveis:** modelos para grêmio, representantes, CIPA, conselho, associação e outros, com quórum inteiro de 0 a 100% e regra de empate (`commission` ou `runoff`). Os modelos não garantem conformidade com normas legais ou estatutos.
6. **Quórum e empate:** as regras, a quantidade de aptos, o comparecimento e os indicadores calculados constam do manifesto assinado. O verificador externo recalcula os indicadores sem receber nomes.
7. **Relatório de apuração:** CSV somente após lacração e assinatura válida, autorizado a membros da organização. Campos exportados recebem neutralização contra fórmula de planilhas. Nenhum identificador de pessoa acompanha o relatório.
8. **Atividade administrativa:** log somente de mudanças institucionais e de emissão/importação, sem vincular eleitores a escolhas.

## Ordem operacional

1. Criar contas de responsável, gestor e fiscal; configurar o perfil institucional.
2. Criar a eleição futura com opções, datas, quórum e política para empate.
3. **Antes de gerar credenciais**, importar a lista de aptos. Se o processo parar no meio de muitos lotes, concluir a importação antes de emitir qualquer credencial.
4. Conferir a lista. A emissão não associa automaticamente um identificador individual a uma credencial: a instituição deve distribuir e registrar entrega por procedimento independente, sem coletar escolha do voto.
5. O primeiro gestor gera credenciais; o segundo recebe os códigos separados, como na versão 0.6.
6. Testar votação fictícia, executar `npm run election:preflight -- <UUID>`, e seguir com votação.
7. No encerramento, a comissão executa `npm run audit:seal -- <UUID> <CHAVE_PRIVADA>` e publica externamente a impressão do manifesto. O CSV e a página de resultados ficam disponíveis após lacração.

## Proteção de dados e limites

- Não importar CPF real ou informação sensível sem necessidade. Prefira códigos institucionais pseudônimos; é indispensável definir base legal e prazo de retenção, especialmente para crianças e adolescentes.
- O HMAC não permite consulta do identificador original: use documentos da instituição para corrigir cadastros. Os gestores podem visualizar nomes decifrados; isso exige acesso mínimo e logs de operação no sistema implantado.
- O CSV importado é processado no dispositivo do gestor e enviado em lotes de até 200 linhas. Em caso de falha num lote, os anteriores podem ter sido aplicados; verificar a contagem antes de repetir.
- Não há autoatendimento de recuperação de credenciais nem vinculação automática entre pessoa e token; nunca compartilhar listas de aptos publicamente.
- A versão 0.7 ainda não oferece E2E-verificabilidade nem chaves em múltipla custódia. Servidores com privilégios podem afetar o sigilo e a integridade antes da lacração.
- A plataforma web não impede capturas de tela por SO, extensões ou câmeras de outro telefone. Não prometer proteção absoluta.
- Quórum usa **número de cédulas depositadas, incluindo brancos e nulos**, dividido pelo número de eleitores aptos. Se houve cadastro de aptos, credenciais emitidas não podem superar esse número.
- Se `quorum_percent>0`, a lista de aptos é obrigatória antes da emissão de credenciais e da lacração. Falta de quórum e empate são relatados; o software não declara vencedor automático.
- Sem lista de aptos, `quorum_percent=0` é apenas simulação de voto por credenciais e os indicadores de participação não têm denominador válido.
- Assinatura do manifesto protege a versão lacrada; não comprova que nada foi alterado antes da assinatura.

## Migração

- Arquivo `sql/schema.sql`: somente para banco **novo/vazio**.
- Arquivo `sql/migrate_0_6_to_0_7.sql`: mudança em banco 0.6 existente, após **backup testado, congelamento das operações e revisão manual dos dados**. Não aplicado automaticamente a qualquer banco.
- Executar `npm run keys` e configurar nova variável `ROSTER_PROTECTION_KEY` (32 bytes hex). Não mudar essa chave durante o uso: é necessária para comparar identificadores e decifrar nomes.
- Não publicar `.env.local`, nomes de eleitores ou chaves no repositório.

## Evidências de teste

- Testes unitários da versão anterior: 19 de 19 continuam passando.
- Testes adicionais v0.7: criptografia do cadastro, validação e deduplicação, quórum, empate, assinatura com verificação externa de indicadores, proteção CSV.
- Total do comando `npm test`: **24 de 24 passaram**.
- Sintaxe de 51 fontes JS/JSX verificada com TypeScript transpile (não substitui build Next.js).
- `npm install` falhou: DNS `EAI_AGAIN` ao consultar registry.npmjs.org. Sem lockfile e sem `next build` completo.
- Testes de integração HTTP e aplicação de migração no PostgreSQL real v0.7: **não executados**. Resultados anteriores de concorrência (v0.6) não validam automaticamente o novo módulo.
- Teste de invasão e avaliação LGPD: pendentes.

## Critérios de aceite para implantação

A) Next.js compila sem erro; B) migrations testadas e revertíveis; C) imports 10k sem exfiltração de nomes; D) duas organizações não consultam cadastro/relatório uma da outra; E) testes HTTP de credencial única e concorrência; F) emissão não supera cadastro; G) assinatura da comissão confere e relatórios inválidos não são publicados; H) backup, recuperação e política LGPD; I) auditoria independente de segurança antes de eleição vinculante.
