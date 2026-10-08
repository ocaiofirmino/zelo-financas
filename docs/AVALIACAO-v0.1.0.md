# Avaliação do Zelo — v0.1.0

Revisão realizada em **08/10/2026**. Escopo: o dashboard Zelo da pasta `folga-financas`, sua API, banco local, exportações e arquivos destinados ao repositório. O protótipo separado de login e cadastro não está integrado a esta versão.

## Parecer

**O código pode ser publicado no GitHub como v0.1.0, um MVP de finanças pessoais com uso local.** A instalação em uma pasta limpa, a compilação e as principais operações foram verificadas. A descrição da versão deve deixar claro que o login próprio e o acesso público para múltiplos usuários ainda estão em desenvolvimento.

Publicar o código no GitHub não configura automaticamente hospedagem, autenticação ou um serviço público. A revisão não autoriza afirmar que o sistema está pronto para produção com usuários externos.

## Funcionalidades verificadas

- Dashboard com resultado realizado e previsto, meta, categorias e próximos vencimentos.
- Cadastro, edição e exclusão de receitas e despesas; parcelas com valores em centavos e ajuste de datas no fim do mês.
- Metas e limites vinculados ao usuário, com persistência após reiniciar o Worker.
- Consulta dos dados isolada entre identidades distintas nos testes da API.
- Exportação XLSX, CSV e CSV para Power BI, com seleção de mês ou histórico completo e proteção dos textos contra fórmulas nos CSVs.
- Navegação das quatro telas, menu responsivo, retorno do foco após fechar formulários e reinicialização do período ao reabrir a exportação.

Os exemplos financeiros usados na revisão eram fictícios. Os testes da API utilizaram um banco separado do banco pessoal.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run lint` | Aprovado, sem erros ou avisos do ESLint. |
| `npx.cmd tsc --noEmit` | Aprovado. |
| `npm.cmd run test:finance` | Aprovado. |
| `npm.cmd run test:export` | Aprovado. |
| `npm.cmd run build` | Aprovado. |
| Instalação limpa com `npm.cmd run install:ci` | Aprovada, seguida de compilação, criação de banco vazio e inicialização do servidor. |
| Teste existente da API e 37 verificações adicionais | Aprovados: operações, validação, isolamento, origem e persistência. |
| Exercício adicional de divisão das parcelas | 16.140 combinações fictícias verificadas. |

A compilação emite um aviso de tamanho de alguns arquivos JavaScript, acima de 500 kB. Isso não impediu a execução; a redução do carregamento inicial é uma melhoria futura.

A verificação visual responsiva deste ciclo foi feita em uma largura efetiva de 500 px, limitada pelo navegador de teste. Ela não representa uma certificação de todos os dispositivos. O formato dos arquivos exportados foi verificado pelos testes do módulo; não foi criado ou validado um dashboard `.pbix` nesta revisão.

## Ajustes realizados na revisão

- Correção dos problemas apontados pelo lint e da restauração de foco dos formulários.
- Validação mais estrita de `statusOnly`, meta numérica e limites por categoria na API.
- Proteção da navegação de meses nos limites aceitos pelo sistema, de janeiro de 2000 a dezembro de 2100.
- Identificação do pacote como `zelo-financas`, versão `0.1.0`.
- Atualização de Next.js, React, Vite e dependências transitivas compatíveis, mantendo o arquivo de versões travadas.
- Ampliação do `.gitignore` para bancos, arquivos de ambiente, extratos e backups locais.
- README com propósito, tutorial, cálculos, instalação, exportações, persistência e tecnologias reais, com a faixa de ícones inspirada na referência.

## Limitações antes de oferecer acesso público

### Autenticação

A API recebe a identidade por cabeçalhos fornecidos pelo ambiente Sites. No desenvolvimento local, o ambiente utiliza uma identidade fixa de teste. Consultas vinculadas ao usuário não substituem a verificação da identidade.

Antes de expor o Worker diretamente à internet, implemente login próprio ou use um gateway confiável que remova os cabeçalhos enviados pelo cliente e insira a identidade autenticada. Um cliente não deve poder escolher esses cabeçalhos. Cadastro, recuperação de senha e testes de sessão ainda precisam ser integrados ao dashboard.

### Dependências

Na consulta de 08/10/2026, `npm audit --omit=dev` apresentou **2 ocorrências moderadas, nenhuma alta ou crítica**. A auditoria completa apresentou **16 ocorrências por pacote: 8 altas, 6 moderadas e 2 baixas, nenhuma crítica**. Essas contagens incluem a propagação de um mesmo alerta por dependências relacionadas; não representam 16 falhas distintas do Zelo.

As ocorrências de produção estão na cadeia ExcelJS/uuid. O [aviso do uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq) descreve funções com buffers; o uso encontrado no ExcelJS é `uuid.v4`. Isso limita a exposição observada, mas não elimina o alerta da dependência. As ocorrências altas restantes envolvem ferramentas de desenvolvimento e o [aviso do braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), sem correção publicada na consulta. A cadeia do Drizzle também mantém uma versão antiga do esbuild, descrita em seus [avisos de desenvolvimento](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

Não foi aplicado `npm audit fix --force`, pois isso pode alterar versões de forma incompatível. Os alertas restantes devem ser acompanhados. O projeto utiliza Vinext em versão beta.

### Execução local e abrangência

Requisições anônimas sem corpo receberam 401. Em uma sequência rápida de requisições anônimas com JSON, o proxy local do Wrangler retornou 503 em PATCH/DELETE com mensagem de reinicialização do Worker. Não houve retorno de dados nem gravação indevida observada. Esse comportamento de transporte local precisa ser investigado antes de oferecer um serviço público.

Não foram realizados testes de carga, auditoria externa, implantação pública ou execução de CI no GitHub nesta revisão.

## Conteúdo para o GitHub

O pacote da primeira versão contém o código, configuração necessária, migrações, testes, fontes, logos e documentação. A pasta `build/` contém código necessário ao projeto e deve permanecer no repositório. A configuração `.openai/hosting.json` também é usada pela compilação.

O pacote exclui `node_modules`, compilações, caches, `.wrangler`, `.sites-runtime`, arquivos de ambiente, bancos e extratos pessoais. **O ZIP do código não é um backup das suas finanças.** Preserve o banco local separadamente.

Não foram encontrados segredos nem registros financeiros pessoais nos arquivos revisados para publicação. As licenças das fontes e componentes de terceiros foram preservadas. O projeto ainda não possui uma licença própria na raiz; o autor deve escolher a licença se desejar conceder direitos de reutilização a terceiros.

Sugestão de identificação no GitHub: **Zelo v0.1.0 — controle financeiro pessoal**. A faixa visual de tecnologias usa o projeto [Skill Icons](https://github.com/tandpfun/skill-icons), com ícones das tecnologias efetivamente utilizadas.
