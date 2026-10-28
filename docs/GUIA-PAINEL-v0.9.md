# VotaLivre Secure 0.9 — Central de Apuração, Telão e Relatórios

## Acesso

- Para uma eleição com UUID `<id>`, o painel público é `/painel/<id>`.
- O link antigo `/resultados/<id>` é redirecionado para o mesmo painel.
- A API pública recebe `GET /api/painel/<id>` e **não** expõe credenciais, votos cifrados, nomes, CPFs ou recibos.
- A exportação CSV é `GET /api/painel/<id>/relatorio`. Só é liberada com status `published`.
- O painel oferece **Imprimir / salvar PDF** usando o diálogo de impressão do próprio navegador; o PDF não é gerado no servidor.

## Regras de publicação

| Fase | Status da API | Conteúdo público |
|---|---|---|
| Antes da abertura | `scheduled` | Nome, instituição, horários, aviso |
| Durante a votação | `voting` | Nenhum parcial de votos nem participação |
| Após fechamento, sem manifesto | `awaiting_seal` | Aviso de lacração pendente |
| Manifesto válido, comissão pendente | `awaiting_committee` | Aviso de aprovação pendente |
| Manifesto e certificado da comissão válidos, após fechamento | `published` | Contagem por opção, válidos, brancos, nulos, abstenção quando disponível, hash do manifesto e aprovação |

**Atenção:** a verificação do certificado utiliza as chaves que o servidor publica. A comissão **precisa comparar as chaves públicas com cópias confiadas e fixadas fora do sistema antes da votação**. Sem essa conferência a autenticidade do emissor não está assegurada.

## Telão e atualização

- Clique em `Modo telão` no painel, no navegador conectado à TV ou ao projetor.
- O botão solicita fullscreen somente com interação do usuário; o navegador pode recusá-lo.
- A página consulta dados a cada 30 segundos, em modo visível, e também quando volta a ficar ativa.
- Se houver erro de rede, o painel mantém o último resultado carregado com alerta de informação desatualizada.
- Para eventos com muitas conexões, implante cache de projeção pública, proteção contra sobrecarga e monitoração antes de uso real.

## Relatório para impressão / PDF

1. Somente após a publicação, clique em **Imprimir / salvar PDF**.
2. No navegador, selecione uma impressora ou **Salvar como PDF**.
3. Configure A4 na horizontal, escala padrão ou ajustar à página e ative gráficos de fundo se disponível.
4. Inclua, no arquivo distribuído, o manifesto assinado, a relação de chaves públicas previamente confiada e o certificado da comissão. O PDF impresso sozinho não prova autenticidade.

O CSV possui proteção contra execução acidental de fórmulas em planilhas, mas deve ser considerado um documento de consulta, não a fonte criptográfica da auditoria.

## Acessibilidade

- As barras apresentam percentuais em texto e valores ARIA.
- Controles são acessíveis pelo teclado, com realce de foco.
- O layout suporta celular, desktop, TV e `prefers-reduced-motion`.
- A interface deve passar por testes reais de leitor de tela e avaliação WCAG antes da homologação.

## Fluxo de auditoria

1. Encerrar no horário configurado.
2. Lacrar com a chave de assinatura offline.
3. Entregar o pacote confidencial apenas aos auditores autorizados; **não publicar a chave de decifragem**.
4. Auditores recontam o pacote fora do sistema e assinam seus endossos usando chaves próprias.
5. Publicar certificado após alcançar quórum definido antes do pleito.
6. Comparar chaves em canais independentes; conferir o hash do manifesto.
7. Publicar painel, relatório CSV e PDF de apresentação.

## Limitações

- O protótipo continua sob teste. Nenhuma publicação prova ausência de coação, malware no celular ou adulteração anterior ao fechamento.
- A aplicação ainda administra a chave de decifragem dos votos; não existe criptografia limiar da escolha.
- Navegadores não permitem proibir universalmente screenshots. Nenhum recurso do painel garante que um eleitor não fotografe a própria tela.
- Nenhum banco foi migrado nesta versão: os recursos de divulgação usam tabelas existentes em 0.8.
