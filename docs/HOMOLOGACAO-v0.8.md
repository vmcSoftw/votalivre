# Relatório de validação — VotaLivre Secure v0.8

**Escopo:** revisão incremental sobre a versão 0.7, com mecanismo de endossos independentes. **Dados de teste inteiramente fictícios.**

| Verificação | Resultado |
|---|---|
| Suíte de testes JavaScript | **36/36 passaram** |
| Novos testes de chaves/quórum e detecção de adulteração | **12/12 passaram** |
| Ensaio operacional: geração de 3 chaves, cadastro 2/3, assinatura e verificação | **Aprovado** |
| Ensaio operacional: chave de lacração não confiada | **Rejeitada** |
| Análise sintática com parser TypeScript | **63 arquivos JS/JSX/MJS sem erros sintáticos** |
| Compilação Next.js | **Não realizada**: `EAI_AGAIN` ao obter Next.js no registro npm |
| Integração HTTP com banco real | **Pendente** |
| Migração 0.7 → 0.8 aplicada a PostgreSQL real | **Pendente** |
| Revisão de segurança independente e pentest | **Pendente** |
| Garantia de sigilo contra administrador privilegiado | **Não fornecida pela arquitetura atual** |
| Votação criptograficamente verificável ponta a ponta | **Não implementada** |

## O que exatamente é validado

- A assinatura individual do fiscal usa Ed25519 e é vinculada ao **SHA-256 exato do manifesto**, **UUID da eleição**, **SHA-256 da lista de chaves confiadas**, número de cédulas e identificação do fiscal.
- O comando de emissão de endosso faz recontagem offline do pacote, conferindo as cédulas cifradas contra os compromissos assinados e o resultado por opção.
- A verificação do certificado recusa assinaturas inválidas, chaves desconhecidas, endossos duplicados, substituição de lista e quórum insuficiente.
- A publicação no banco exige certificado válido e coincidência exata com o manifesto já lacrado. Sua tabela usa inserção única e gatilho que impede alterações por operadores SQL comuns.

## Não comprovado

- A lista/chave publicada no servidor é de fato a lista aprovada pela comissão antes da eleição.
- Os membros realizaram auditorias independentes reais: a assinatura representa uma declaração, e o verificador confere sua autoria matemática.
- Todas as cédulas foram registradas corretamente antes da lacração; o servidor pode ter sido comprometido antes do fechamento.
- Sigilo absoluto no celular (prints, fotos externas e coação continuam possíveis).
- A implantação em Vercel/Neon está apta ao público: os testes de aplicação e carga ainda faltam.

## Condições de avanço

1. Concluir `npm ci && npm run build` com dependências revisadas e lockfile reproduzível.
2. Aplicar migração em **clone de banco de teste**, testar inserção única e bloqueio de alteração do certificado.
3. Exercitar APIs completas em HTTP com credenciais e perfis reais de teste.
4. Executar testes de carga, UX com acessibilidade e revisão de segurança por equipe independente.
5. Registrar provas públicas e custódia externa das chaves e certificados antes de utilizar o sistema em votações institucionais vinculantes.
