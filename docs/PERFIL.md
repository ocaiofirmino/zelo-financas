# Perfil pessoal

Acesse o perfil pelo avatar no rodapé da navegação lateral ou pelo botão **Meu perfil** no celular. Rotas autenticadas: `/app/perfil` e `/app/perfil/editar`.

Campos: como quer ser chamado, nome completo, e-mail de contato, telefone, cargo/profissão, empresa, salário mensal, até seis dias recorrentes de pagamento e foto de perfil. O e-mail de contato não muda a identidade usada na autenticação pelo ChatGPT.

O salário é armazenado em centavos e aceita `4500,50`, `4.500,50` e `4500.50`. As datas são dias do mês de 1 a 31, com sugestões de quinzena e personalização. Em meses mais curtos, a próxima data usa o último dia do mês, sem duplicar eventos. Não são criadas receitas nem alteradas as agendas já existentes dos cofrinhos.

As fotos aceitam JPG, PNG e WebP de até 5 MB. São recortadas no centro e ajustadas para 256×256 antes do envio. O servidor valida formato, assinatura e tamanho. Há prévia e remoção. Os dados ficam na tabela `profiles`, separados pelo identificador da conta autenticada. Os dados de demonstração são temporários e separados dos pessoais.

A migração `drizzle/0002_perfil.sql` já foi aplicada no banco local desta cópia. Em outra instalação com o build e as migrações anteriores preparados, aplique `npm run db:perfil` uma única vez.

Validação: `npm run test:profile`, `npm run test:profile-api`, lint e TypeScript. A verificação da API executa os handlers reais e suas consultas SQL em SQLite temporário, sem modificar perfis pessoais. A conferência no navegador cobre a edição, cancelamento, foto, calendário, troca de modos e cinco larguras de tela.

## Liberação de contas

O fluxo pessoal descrito acima está preparado, mas permanece bloqueado por `lib/app-access.ts` até a integração futura do backend de cadastro e login. No estágio atual, todas as telas de perfil operam com exemplos temporários. Os dados previamente salvos não são apagados e não são lidos pela interface.
