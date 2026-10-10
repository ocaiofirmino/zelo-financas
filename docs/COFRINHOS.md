# Cofrinhos pessoais — branch experimental

Esta função está na branch `feature/cofrinhos`, criada a partir da `main`. A `main` e a demonstração pública `demo/vercel` permanecem separadas. Esta alteração não abre PR, não faz merge e não publica uma nova versão do site.

## Para que serve

O cofrinho acompanha um objetivo concreto: uma viagem, uma festa, um celular ou outro plano. Ele tem nome, valor total, prazo, planejamento mensal e os dias em que você pretende guardar dinheiro. Você pode criar várias metas, sem limite fixo de quantidade.

A antiga **Meta de sobra** foi retirada da interface desta branch. Ter um resultado positivo no mês não preenche os cofrinhos automaticamente. O progresso muda quando você registra o dinheiro que efetivamente guardou.

## Como usar

1. Abra **Meu controle** para usar seus dados pessoais. Os exemplos da demonstração ficam separados.
2. Entre em **Cofrinhos** pelo cabeçalho; no celular, use o menu hambúrguer. O painel **Meu mês** também mostra um resumo das metas.
3. Clique em **Novo cofrinho**, informe o nome, o total desejado e o prazo.
4. Defina quanto pretende guardar por mês. A sugestão considera o prazo e os meses que ainda têm uma data de aporte disponível; você pode ajustar o planejamento.
5. Informe seus dias de recebimento, como **5 e 15**. Use a divisão igual ou personalize as proporções.
6. Se já tiver uma quantia reservada, informe-a no cadastro. Ela entra como saldo inicial na data de criação: conta para o objetivo total, sem preencher o planejamento mensal de novos aportes.
7. Quando guardar dinheiro, clique em **Guardar**, informe o valor e a data e salve. Use uma data de hoje ou do passado; um aporte futuro é apenas uma sugestão, não dinheiro já guardado.
8. Consulte o saldo, a porcentagem e o histórico. Você também pode registrar retiradas, corrigir um registro por exclusão e novo cadastro, editar o planejamento ou arquivar a meta.

Um cofrinho com histórico é arquivado para preservar os registros. A exclusão de uma meta vazia serve para corrigir um cadastro feito por engano. Uma retirada maior que o saldo é recusada; apagar um aporte também é recusado quando isso deixaria o saldo negativo.

## Exemplo de planejamento

Em **10/10/2026**, imagine uma meta de viagem de **R$ 6.000,00 até 31/05/2027**, com **R$ 1.800,00 já guardados** e planejamento de **R$ 600,00 por mês**:

| Situação                                          |       Valor |
| ------------------------------------------------- | ----------: |
| Progresso da meta                                 |         30% |
| Aporte registrado em 05/10, incluído nos R$ 1.800 |   R$ 200,00 |
| Sugestão para 15/10                               |   R$ 400,00 |
| Total reservado após esse aporte                  | R$ 2.200,00 |
| Progresso após esse aporte                        |      36,67% |

Em um mês completo sem aportes registrados, dias 5 e 15 recebem **R$ 300,00 cada**. Se uma data passar, o que ainda falta guardar no mês é distribuído entre as próximas datas. Aporte avulso reduz o restante; retirada aumenta o restante, respeitando o valor que falta para a meta.

Datas depois do prazo não recebem sugestões. Dias 29, 30 e 31 são ajustados ao último dia de meses menores. Datas que coincidem após esse ajuste são agrupadas, e o rateio fecha o total em centavos.

Se não houver mais datas disponíveis antes do prazo, o sistema sinaliza a necessidade de ajustar o planejamento. O valor mensal sugerido é uma divisão matemática do objetivo, não uma avaliação da sua capacidade financeira. Considere os planos de todos os cofrinhos juntos ao definir quanto guardar.

## Relação com suas finanças

Aportes e retiradas são **registros de reserva**, sem conexão com bancos. Aporte não cria uma nova despesa e retirada não cria uma nova receita. Seus lançamentos e o demonstrativo financeiro continuam representando entradas e saídas cadastradas.

O histórico dos cofrinhos fica no sistema. Os extratos XLSX, CSV e CSV para Power BI desta versão continuam exportando lançamentos financeiros e parcelas; ainda não incluem uma tabela de aportes.

## Dados salvos

No modo pessoal, `/api/savings` grava as metas e os movimentos no SQLite / Cloudflare D1, vinculados ao `userId` da autenticação existente. Fechar o navegador ou reiniciar o servidor não apaga esses dados.

A autenticação atual ainda depende do ambiente Sites/ChatGPT; a prévia local usa sua identidade de teste. Esta função não implementa cadastro ou login próprios por e-mail e senha. A demonstração usa exemplos em memória e não altera seus cofrinhos pessoais.

## Atualizar um banco local existente

Faça backup de `.wrangler/state` com o servidor parado. Na raiz do projeto:

```powershell
git switch feature/cofrinhos
npm.cmd run build
npm.cmd run db:cofrinhos
npm.cmd run dev
```

`db:cofrinhos` aplica **somente `drizzle/0001_cofrinhos.sql`**. Execute uma vez por banco. Ele acrescenta as tabelas dos cofrinhos, sem apagar ou converter seus lançamentos, limites ou preferências anteriores. Não repita `db:setup` em um banco que já tem dados.

## Instalação em uma pasta nova

```powershell
npm.cmd run install:ci
npm.cmd run build
npm.cmd run db:setup
npm.cmd run db:cofrinhos
npm.cmd run dev
```

## Verificações

```powershell
npm.cmd run test:finance
npm.cmd run test:export
npm.cmd run test:savings
npx.cmd tsc --noEmit --incremental false
npm.cmd run build
```

Para verificar a API com usuários fictícios, inicie o Worker compilado em um terminal:

```powershell
npm.cmd start -- --port 5174
```

Em outro terminal, execute `npm.cmd run test:savings-api`. O teste cria e remove seus próprios registros fictícios; ele não deve ser executado contra um ambiente público ou banco de produção.
