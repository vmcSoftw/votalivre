# Plano de homologação — v0.4

## Checklist antes de uso real

- [ ] Instalar dependências com verificação do arquivo de lock e executar `npm run build` sem erros.
- [ ] Rodar migrations num PostgreSQL dedicado, com usuário sem privilégios de superusuário.
- [ ] Testar emissão de duas listas e distribuição por canais independentes.
- [ ] Testar credencial correta + código correto: registra exatamente 1 voto.
- [ ] Testar credencial correta + código incorreto: não consome credencial nem gera voto.
- [ ] Testar credencial usada novamente: deve recusar.
- [ ] Testar sete tentativas com código errado: bloquear temporariamente por credencial.
- [ ] Testar que uma eleição de outra organização não é editável nem pode receber credenciais.
- [ ] Testar milhares de participantes simultâneos em múltiplos processos e regiões.
- [ ] Verificar que reversão de transação não deixa recibos órfãos e que o fechamento compete com votos concorrentes.
- [ ] Confirmar capacidade de recuperação de dados após perda de conexão e indisponibilidade de banco.
- [ ] Validar assinaturas e manifesto num ambiente offline independente.
- [ ] Examinar logs, proxy, backups, monitoramento e ordem das transações para riscos de associação eleitor-voto.
- [ ] Revisão de segurança, pentest externo e avaliação LGPD (menores, retenção e incidentes).
- [ ] Habilitar HTTPS, WAF/DDoS e rate limiting de rede em produção.

## Política de liberação

Sem os itens acima, o software só deve ser usado em laboratório e eleições simuladas. A ausência de erro em testes unitários **não equivale** a aprovação da segurança eleitoral.
