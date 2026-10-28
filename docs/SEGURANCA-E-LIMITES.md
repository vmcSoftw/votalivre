# Modelo de segurança e limitações — VotaLivre Secure v0.3

## Escopo

Plataforma de **protótipo de votação institucional**, para pilotos controlados em escolas, associações e empresas. NÃO é sistema certificado, não oferece verificabilidade criptográfica ponta a ponta, nem proteção comprovada contra administradores com acesso ao servidor. Não utilizar em votações estatutárias vinculantes ou sensíveis sem auditoria independente, regras claras de disputa e governança.

## Implementado no código

- Organizações segregadas por `organization_id`. Contas individuais (gestores e auditores) atribuídas a organização.
- Senhas com scrypt e sal aleatório (não guardar texto claro), TOTP obrigatório por app autenticador e segredo TOTP cifrado em AES-256-GCM com chave do servidor.
- Sessões aleatórias de 256 bits guardadas apenas por hash, cookie `HttpOnly`, `SameSite=Strict`, `Secure` em produção, timeout absoluto 4 horas e idle de 20 minutos.
- Limite de 8 tentativas falhas por conta/organização por janela de 15 minutos. Em ambiente real exige WAF e limitador distribuído complementar por origem.
- Credenciais de voto aleatórias de 256 bits, armazenadas com HMAC-SHA256 e consumidas atomica e exclusivamente uma vez em transação Postgres.
- Escolhas cifradas em AES-256-GCM com nonce independente e dados autenticados pelo identificador da eleição. `ballots` não guarda nome/CPF, token ou opção em claro.
- A apuração publicada depende de lacração pela comissão após o encerramento. A aplicação ainda possui a chave mestra capaz de derivar chaves das eleições.
- Recibos aleatórios não mostram candidato. Recibos e cédulas estão em tabelas distintas, sem ligação direta; consulta de existência somente após encerramento.
- `Cache-Control: no-store`, CSP com nonce, proteção anti-clickjacking, HSTS em produção, checagem de origin e limites de payload.
- Modo de privacidade visual: cédula obscurecida quando a janela perde foco, impressões normais do navegador mascaradas, bloqueio best-effort de Ctrl+P.

## Limites que impedem promessa de “segurança de ponta” já comprovada

1. **Capturas de tela:** navegadores NÃO podem impedir de forma universal screenshots realizados pelo sistema operacional, extensão, hardware ou outro celular. Bloquear Ctrl+P e usar CSS de impressão não basta. Android nativo pode aplicar `FLAG_SECURE`, embora nem esse mecanismo evite uma câmera externa. Em iOS, a notificação de screenshot vem depois da captura e gravações podem ser detectadas em alguns contextos.
2. **Sigilo em votação remota:** o administrador de infraestrutura com acesso simultâneo às chaves, logs de requisições, fluxo de rede ou ordem de inserções pode tentar correlacionar eventos. Separar tabelas e criptografar no servidor NÃO oferece sigilo contra esse ator. Para votação de alto impacto, projeto E2E-verificável com codificação e cifragem no cliente, mistura ou decriptação homomórfica, chaves sob custódia de múltiplos membros independentes e protocolos anticorrelação auditados.
3. **Coação/compra de voto:** nenhum site pode garantir que alguém não esteja vendo a tela do eleitor, usando câmera externa ou forçando a votação. Projetar governança, cabines opcionais, re-votação quando apropriado, treinamento e canais de denúncia.
4. **Integridade da apuração:** o recibo prova somente existência no banco. AES-GCM protege contra adulteração não autorizada sem a chave, mas operadores com acesso a aplicação/chaves e administradores do Postgres podem alterar votos, resultados ou credenciais. É necessário usar logs externos imutáveis, provas de integridade e auditores independentes.
5. **Identidade do eleitor:** posse de credencial de uso único não autentica o votante real. Validar o eleitor por procedimento independente e auditável antes da distribuição e revogação de credenciais.
6. **Disponibilidade:** implementar WAF, DDoS, proteção de bots, rate limiting por infra confiável, fila, monitoração, observabilidade com privacidade, backups e testes de restauração.
7. **Governança:** políticas de retenção e consentimento/base legal LGPD, impacto para menores, acessibilidade WCAG 2.2 AA, revisão e contestação, lacração/snapshot de candidaturas, controles de desligamento do pleito e plano de incidentes.
8. **Segurança da infraestrutura:** chaves em secret manager/KMS, separação de permissões do Postgres, pinagem de dependências, SAST, DAST, revisão OWASP ASVS 5.0, teste de invasão externo, monitoramento e recuperação de desastres.
9. **Chaves:** se `BALLOT_ENCRYPTION_KEY` for perdida, nenhum resultado poderá ser apurado; não imprima ou registre chaves e nunca as envie para navegador. Não mudar a chave durante uma eleição em andamento.
10. **Limite de escalabilidade:** a apuração desta versão lê todos os votos cifrados no servidor ao final; para votação grande, desenhar pipeline de apuração offline com revisão e reconciliação auditável.

## Sugestão para wrapper Android (não integrado ao web app)

```kotlin
// Dentro da Activity Android que apresenta a WebView
window.setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE
)
```

O trecho reduz screenshots/gravação no Android nativo em dispositivos compatíveis, **não** se aplica a browsers e não pode impedir fotos por outra câmera.

## Critérios mínimos antes de produção

- Revisão de código independente e teste de invasão com relatório.
- Teste de concorrência de um token tentando votar duas vezes, garantindo exatamente um voto.
- Teste de isolamento entre organizações, inclusive acessos maliciosos ao API.
- Revisão de credenciais e MFA, recuperação e revogação de contas.
- Auditoria de LGPD e política para menores de idade.
- Apuração reexecutável por comissão independente, comparada com comprovantes e dados lacrados.

## Referências

- OWASP ASVS 5.0: https://asvs.owasp.org/
- Android FLAG_SECURE: https://developer.android.com/security/fraud-prevention/activities
- Apple captura de tela: https://developer.apple.com/documentation/UIKit/UIScreen/isCaptured
- ANPD: https://www.gov.br/anpd/

## Mudanças de auditoria na versão 0.3

O manifesto, assinado fora do servidor web, reúne o resumo da contagem e compromissos criptográficos de cédulas e recibos. O verificador de comissão reproduz a contagem a partir de um pacote **confidencial** cifrado, sem nomes ou matrículas, validando os hashes e a assinatura com uma chave pública previamente distribuída. Isso fortalece a verificabilidade pós-lacração **sem proporcionar verificabilidade ponta a ponta**.

A comissão deve preservar o hash do manifesto fora da plataforma. Mesmo assim, pessoas com controle da base e das chaves antes do fechamento poderiam produzir evidências consistentes de um estado adulterado. Esse risco permanece aberto e exige arquiteturas de chaves de múltiplas partes, publicação externa durante votação e revisão independente.


## Nota da versão 0.5

Em 28/10/2026 a dependência Next.js foi fixada na versão 15.5.28 e React/React-DOM em 19.0.9 (com correções divulgadas em outubro). **Sem build/lockfile, não se pode atestar a cadeia de dependências instalada.** Mantenha a auditoria de dependências e atualizações de segurança como requisito. A homologação PostgreSQL SQL isolada comprova apenas a propriedade específica testada; não a segurança global do aplicativo.

## Mudanças na v0.6 (2026-10-28)

Emissão dividida entre dois gestores distintos com PINs temporariamente cifrados, entrega única e cancelamento do lote antes da abertura. Foi adicionado limitador SQL de tentativas por origem, com confiança condicional no `X-Forwarded-For` sobrescrito pela Vercel. O limitador por origem não se substitui ao WAF, pode afetar vários eleitores em um mesmo NAT e não evita ataque distribuído. O servidor continua conhecendo os segredos; o sigilo criptográfico contra quem controla simultaneamente servidor e banco não foi solucionado.

O projeto ainda não passou no build Next.js, testes end-to-end ou teste de invasão externo. Não aplicar seu esquema em bases da versão anterior como se fosse migração.
