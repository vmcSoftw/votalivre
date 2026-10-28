# Guia operacional da comissão — v0.8

## Antes da eleição

1. A instituição define integrantes, substitutos e quórum mínimo (ex.: **dois de três**), registrando esse regulamento em ata.
2. Cada integrante gera o par de chaves Ed25519 na máquina sob seu controle. Chave **privada nunca é entregue** ao operador do sistema, e um segundo membro não pode assinar em seu lugar.
3. Colete somente as chaves **públicas** e crie a lista `comissao.json` usando `committee-create-roster.mjs`.
4. Publique **fora do VotaLivre** a impressão SHA-256 da lista (`committeeRosterFingerprint`) e da chave pública da lacração; preferencialmente em ata assinada e em um repositório imutável independente.
5. Registre também o identificador UUID da eleição. A chave e a lista precisam estar fixadas **antes do recebimento dos votos** para reduzir o risco de substituição posterior.

## Após o encerramento

1. Comissão acompanha o encerramento e a lacração (`audit:seal`), confronta o número de votantes, credenciais usadas, cédulas e recibos.
2. Faça cópia do manifesto assinado e publique seu hash em canal independente.
3. Exporte o pacote confidencial (`audit:export`); esse pacote contém a chave de decifragem da votação e **nunca** deve ser servido por uma rota pública.
4. **Cada fiscal** obtém e confere o manifesto, verifica a chave pública da lacração fixada antes do pleito e realiza a recontagem em sua própria máquina com `committee-approve.mjs`. Esse comando chama `verifyAuditBundle`, então a assinatura não é produzida se a recontagem falhar.
5. Colete apenas `*.approval.json` (sem chaves privadas e sem pacote confidencial), gere o `certificado.json` e valide-o com `committee-verify.mjs` usando a lista previamente guardada por canal independente.
6. Publique o certificado e **guarde uma cópia fora do sistema**. Se desejar a exibição no painel público, execute `committee-publish.mjs` num banco já migrado.

## Contestação e incidentes

- **Assinatura inválida, divergência de votos, chave pública trocada, quórum insuficiente**: não publique certificado; preserve os materiais e registre incidente em ata.
- **Credencial vazada, coação, aparelho comprometido**: esse processo de assinaturas pós-voto não resolve o incidente; trate separadamente com comissão, regulamento e avaliações jurídicas aplicáveis.
- **Chave de decifragem exposta**: suspenda a distribuição do pacote, restrinja o acesso, preserve evidências; avalie efeitos sobre sigilo e regras de reexecução da votação.
- **Substituição de auditores**: não edite o cadastro no meio da votação sem procedimento formal. O certificado v0.8 recusa assinaturas de chaves não registradas.

## Transparência e limites

A página `/comissao/<uuid>` confere assinaturas matematicamente a partir do certificado que o próprio servidor apresenta. **Isso não comprova a autenticidade da chave de origem.** Qualquer observador externo deve baixar o certificado, conferir a chave da lacração e a lista de auditores com cópias registradas independentemente e executar `committee:verify`.

Aprovação multiassinada **não é criptografia limiar (threshold decryption)**. A chave de votação da aplicação continua acessível à infraestrutura que realiza a lacração. O passo futuro de sigilo robusto é substituir essa arquitetura por uma tecnologia de votação verificável ponta a ponta desenhada e auditada por especialistas em criptografia eleitoral.
