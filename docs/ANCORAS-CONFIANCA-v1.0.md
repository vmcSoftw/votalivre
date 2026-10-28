# Manual de âncoras independentes — versão 1.0 RC

O resultado **não será divulgado** sem duas impressões digitais previamente registradas para cada eleição:

- `sealKeyFingerprint`: SHA-256 da chave pública Ed25519 da lacração em representação DER/SPKI.
- `rosterFingerprint`: SHA-256 canônico da lista de auditores, suas chaves públicas e o quórum necessário.

1. Gerar as chaves em dispositivos sob custódia individual dos fiscais.
2. Gerar a lista `comissao.json` com `npm run committee:roster` conforme guia anterior.
3. Registrar o documento `lacracao-publica.pem` sem jamais incluir a chave privada.
4. Executar `npm run trust:pin -- comissao.json lacracao-publica.pem`.
5. **Antes da eleição**, registrar e entregar a saída JSON aos fiscais por canal diferente do VotaLivre (documento assinado fisicamente, ata, repositório com controle independente etc.).
6. Configurar a variável de ambiente `ELECTION_TRUST_ANCHORS_JSON` no servidor, com o mapa gerado. Para várias eleições, reunir entradas no mesmo mapa. Não colocar chaves privadas nessa variável.
7. Se as chaves não corresponderem à cópia registrada, os dados devem permanecer ocultos. Corrija a divergência por processo formal documentado, nunca aceitando automaticamente a nova chave do portal.

Modelo ilustrativo (valores não utilizáveis):

```
ELECTION_TRUST_ANCHORS_JSON='{"00000000-0000-4000-8000-000000000001":{"sealKeyFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","rosterFingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}'
```

**Verificação fora do portal**

1. Após a publicação, obtenha as respostas JSON de `/api/auditoria/<id>` e `/api/comissao/<id>` em arquivos locais (`auditoria.json` e `comissao.json`).
2. Use `ancoras.json` conforme a cópia previamente fixada pela comissão, não uma cópia baixada exclusivamente do servidor auditado.
3. Execute `npm run audit:publication -- auditoria.json comissao.json ancoras.json`.
4. Confira `verified: true`, ID da eleição, total de votos e quantidade de endossos.

**Limites:** as verificações confirmam assinaturas e concordância entre documentos, não que cada celular computou a intenção do eleitor. A infraestrutura também pode ser comprometida antes do fechamento. Consulte `HOMOLOGACAO-v1.0.md`.
