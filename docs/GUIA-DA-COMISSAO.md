# Manual da comissão fiscalizadora — VotaLivre v0.4

## O que esta versão permite verificar

1. **Reconciliação interna**: número de credenciais utilizadas = cédulas cifradas = recibos registrados. Se qualquer quantidade divergir, a lacração é recusada.
2. **Recontagem fora da aplicação**: a comissão confere um pacote confidencial usando um programa Node.js independente da interface web e a chave específica daquela eleição.
3. **Assinatura Ed25519**: o documento público de fechamento é assinado pela comissão. Sua chave pública precisa ser publicada/preservada fora do VotaLivre **antes da votação**.
4. **Hashes e raízes de Merkle**: o manifesto enumera hashes de cédulas cifradas e de recibos em listas distintas e traz as impressões criptográficas de cada conjunto.
5. **Conferência de recibo**: após o encerramento, o eleitor verifica que o hash de seu comprovante consta no conjunto publicado. **Isso não certifica que o candidato pretendido foi contado corretamente.**

## Instalação segura

1. Use **PostgreSQL novo e vazio** (esquema v0.3 incompatível com v0.2).
2. Configure segredos e banco sem enviá-los ao repositório (`.env.local`).
3. Gere o par de chaves de auditoria **fora do servidor de produção**:
   ```bash
   npm run audit:keys -- /diretorio-privado/comissao-private.pem /diretorio-publico/comissao-public.pem
   ```
   O segredo privado não deve ficar no site nem na base de dados. A comissão deve distribuir a chave pública por canal independente e registrar sua impressão digital antes da eleição.
4. Após o horário de encerramento, numa máquina administrativa restrita que possua as variáveis `DATABASE_URL` e `BALLOT_ENCRYPTION_KEY`:
   ```bash
   npm run audit:seal -- UUID-DA-ELEICAO /diretorio-privado/comissao-private.pem
   ```
   O comando recusa executar enquanto a votação está aberta, se houver divergência nos totais ou se já houver uma lacração.
5. **Publique em local independente** o manifesto assinado e sua impressão SHA-256. A página pública da eleição estará em `/auditoria/UUID-DA-ELEICAO` e o JSON em `/api/auditoria/UUID-DA-ELEICAO`.
6. Em máquina segura da comissão (não em estações públicas), exporte:
   ```bash
   npm run audit:export -- UUID-DA-ELEICAO /diretorio-privado/pacotes
   ```
   O arquivo `.CONFIDENCIAL.json` **contém a chave derivada capaz de revelar os votos individuais**; não pode ser enviado ao público, publicado ou anexado a e-mails desprotegidos. Não contém identidade ou recibo associado, mas riscos de correlação indireta continuam possíveis.
7. Um auditor separado executa a recontagem:
   ```bash
   npm run audit:verify -- /diretorio-privado/pacotes/UUID.CONFIDENCIAL.json /chaves-guardadas/comissao-public.pem
   ```
   Não confie somente na chave pública enviada junto com o pacote; compare com a versão distribuída **antes** da eleição.

## Limitações fundamentais

- **Não é auditoria ponta a ponta** e não comprova que o celular exibiu/registrou exatamente a opção selecionada pelo eleitor.
- A equipe com acesso a servidor, banco e chaves pode, em certos cenários, agir antes da lacração. O documento assinado pode atestar um estado já comprometido. Para independência real, é necessário observar e publicar compromissos durante a votação, em custódia fora do servidor, e separar a geração/custódia das chaves entre auditores.
- A assinatura verifica integridade do documento **depois da emissão**. Ela não prova lisura do pleito, legitimidade dos participantes, resistência a coerção, nem impede votos por terceiros que possuam credenciais.
- Criptografia em repouso e isolamento lógico não eliminam risco de associação por IP, logs de aplicação, timestamps, transações do Postgres, observação física ou falhas do dispositivo do eleitor.
- Uma recontagem offline usando a chave de eleição descriptografa cada cédula sem nome; **não divulgue o pacote confidencial**. O sistema não foi submetido a pentest independente, nem a build/integração com Postgres reais no ambiente de criação.
- Retenção e eliminação de registros devem ser estabelecidas em política de proteção de dados adequada a escolas (incluindo menores) e empresas.
- Nenhum website consegue impedir universalmente screenshot, gravação de tela ou fotografia por outro aparelho.

## Procedimento de incidente

Se houver diferença na contagem, assinatura inválida ou denúncia de credencial indevida: preserve cópias, suspenda a proclamação dos resultados e encaminhe à comissão de fiscalização. Não recrie/assine um manifesto para encobrir a diferença. Registre incidentes sem expor escolhas individuais.


## Emissão de credenciais v0.4

Antes da eleição, gere dois CSVs (credenciais e códigos de confirmação), distribua por canais separados e registre fora do VotaLivre quem recebeu cada linha. Não coloque nomes ou matrículas na tabela de votos. Não há garantia de que a administração não tenha copiado os dois arquivos.
