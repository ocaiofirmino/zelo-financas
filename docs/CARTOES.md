# Cartões e faturas

O Zelo permite cadastrar vários cartões com nome, limite total, dia de fechamento e dia de vencimento. Compras e parcelas ficam vinculadas ao cartão escolhido. A tela Cartões mostra as faturas separadas por cartão e mês, total, pago, pendente, limite disponível e próximos seis meses.

## Regras

- Novas despesas no cartão exigem um cartão do próprio usuário. Receitas e Pix não recebem vínculo de cartão.
- No cadastro de uma compra, a data informada é a **data da compra**. O primeiro vencimento considera o fechamento do cartão. Compras no dia do fechamento ou depois entram no próximo ciclo.
- Quando o dia do vencimento é menor ou igual ao fechamento, o vencimento pertence ao mês seguinte ao fechamento. Exemplo: fecha dia 25, vence dia 5; compra em 24/01 vence em 05/02 e compra em 25/01 vence em 05/03.
- Dias 29, 30 e 31 se ajustam ao último dia do mês. Cada parcela calcula seu vencimento separadamente: uma parcela em fevereiro não altera o dia de vencimento em março.
- O valor total é dividido em centavos, preservando a soma original. Todas as parcelas recebem o mesmo cartão e a data da compra. A situação escolhida vale para a primeira parcela; as seguintes ficam previstas.
- O campo `transactions.date` continua sendo o vencimento utilizado pelo painel mensal. `purchaseDate` guarda a data original da nova compra; `cardId` identifica o cartão.
- Ao editar um lançamento, a data é o **vencimento da parcela**. A edição afeta somente esse lançamento, preservando a regra existente para parcelas. É possível corrigir ou remover o vínculo de cartão sem recalcular o histórico.
- Alterar fechamento ou vencimento do cartão afeta apenas novas compras. Vencimentos já registrados são preservados.
- Limite disponível = limite total menos todas as despesas pendentes do cartão, incluindo parcelas futuras e atrasadas. Valores acima do limite geram um aviso; o cadastro manual continua permitido.
- O sistema não cria uma segunda despesa para o pagamento da fatura. A situação de cada lançamento indica o valor pago e o pendente.
- Cartões com compras vinculadas não podem ser excluídos. O vínculo composto no banco impede associar uma compra ao cartão de outro usuário.
- XLSX, CSV e CSV para Power BI incluem ID e nome do cartão e data da compra. As colunas existentes e sua ordem foram preservadas; os campos novos são acrescentados ao final.

## Histórico e demonstração

A migração não escolhe um cartão para compras antigas. Elas permanecem em **Sem cartão vinculado**, com os valores e vencimentos originais, até serem associadas por edição.

A demonstração usa dois cartões fictícios. Continua somente leitura: cadastro, edição e exclusão ficam reservados ao acesso pessoal, ainda bloqueado por `PERSONAL_ACCOUNTS_ENABLED = false`. `/api/cards` segue o mesmo bloqueio das APIs de finanças, cofrinhos e perfil. Esta implementação não libera login nem contas pessoais.

## Migração

Com backup do banco e o servidor local parado, em uma instalação que já tenha as migrações `0000`, `0001` e `0002`:

```bash
npm run build
npm run db:cartoes
```

O comando aplica **somente `drizzle/0003_multi_cartoes.sql` ao banco local**. Execute uma única vez por banco. A migração cria `credit_cards` e reconstrói `transactions` preservando todos os registros e acrescentando os vínculos e índices. As preferências, cofrinhos e perfis não são alterados. Em um banco novo, aplique primeiro as três migrações anteriores. O banco remoto exige o processo próprio de migração do ambiente de implantação; esta alteração não executa migrações em produção.

## Verificação

```bash
npm run test:finance
npm run test:cards
npm run test:cards-api
npm run test:access
```

`test:cards` verifica fechamento, virada do ano, meses curtos, centavos, parcelas, separação das faturas e CSV/BI. `test:cards-api` executa os handlers reais com SQLite em memória, identidades fictícias e um adaptador de D1; verifica migração, CRUD, isolamento, vínculo do legado e preservação dos vencimentos. Não acessa bancos reais e não substitui a validação do ambiente Workers/D1.
