# Arquivamento, parcelas em grupo e vínculo em lote

Branch: `feature/3-newfeatures`, criada a partir da versão atual de multicartões. Esta entrega não publica uma versão na Vercel e não libera autenticação ou edição na demonstração pública.

## Arquivar e restaurar cartões

Na tela Cartões, os filtros **Ativos** e **Arquivados** separam as consultas. O botão **Arquivar cartão** abre uma confirmação e informa os compromissos pendentes. Faturas, compras e parcelas futuras continuam no histórico e nos totais financeiros. **Restaurar cartão** permite usar o cartão em novas compras novamente.

O servidor recusa novas compras e novos vínculos em cartões arquivados. Corrigir registros que já pertencem a um cartão arquivado continua permitido. Um cartão com histórico não pode ser excluído.

## Editar e excluir parcelas em grupo

Nos formulários de edição e exclusão de uma compra parcelada, escolha:

- **Somente esta parcela**: operação individual, selecionada por padrão.
- **Esta e as próximas parcelas**: inclui a selecionada e as parcelas posteriores da mesma compra, pela numeração da parcela.
- **Toda a compra**: inclui todos os lançamentos existentes da compra, inclusive parcelas já pagas. A confirmação informa a quantidade de parcelas e quantas já estão pagas.

Na edição em grupo, somente os campos que foram editados no formulário são copiados. Editar a descrição não modifica os centavos distribuídos entre as parcelas, nem transforma parcelas futuras em pagas. O campo de valor é **por parcela**, e não o total da compra. Mudar o vencimento distribui as datas mês a mês a partir da parcela selecionada, ajustando meses curtos. Uma data inválida impede a operação completa.

Compras antigas sem vínculo com a compra original continuam com alteração individual. Parcelas que já foram excluídas não são recriadas. A atualização em grupo usa um lote transacional; uma falha de gravação desfaz o lote inteiro.

## Vincular compras antigas em lote

**Vincular compras antigas** lista apenas despesas no cartão sem um cartão associado. Busque pela descrição, selecione até 25 lançamentos e escolha um cartão ativo. A seleção pode incluir lançamentos pagos ou previstos; suas situações, valores, parcelas e vencimentos são preservados.

O servidor verifica a propriedade de todos os lançamentos e do cartão. Seleções duplicadas, inválidas, já vinculadas ou pertencentes a outro usuário são recusadas. A gravação faz uma verificação atômica: nenhum item é alterado se o estado da seleção mudar antes da operação.

## Migração e testes

Depois das migrações `0000` a `0003`, aplique **uma vez ao banco local**, com backup e servidor parado:

```bash
npm run build
npm run db:card-archive
```

A migração `0004_card_archiving.sql` adiciona o estado de arquivamento e considera ativos os cartões existentes. Não altera os lançamentos. A configuração de uma migração remota será tratada junto da implantação.

```bash
npm run format:check
npm run lint
npm run test:cards-api
npm run test:batch
npm run test:access
```

As regras têm testes de centavos, datas, escopos, campos alterados, arquivamento e imutabilidade do histórico. As APIs são exercitadas com SQLite em memória, incluindo propriedade por usuário, vínculo em lote sem atualização parcial e reversão de um lote de edição quando uma gravação falha.

O teste de navegador usa uma compilação isolada com dados fictícios e operações em memória para conferir os três fluxos e gerar capturas. Os arquivos públicos mantêm a demonstração somente leitura, e o teste não implanta nada na Vercel.
