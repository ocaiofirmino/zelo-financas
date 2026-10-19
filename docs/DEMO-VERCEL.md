# Novo design na Vercel

A versão integrada em `main` e `demo/vercel`, originada na `newdesign`, inclui início, dashboard, perfil e cofrinhos com dados fictícios em modo somente leitura. Login e cadastro exibem avisos de manutenção sem formulários. A demonstração não permite criar ou alterar registros. As APIs pessoais continuam bloqueadas até a integração do backend.

O `vercel.json` na raiz instala e compila a versão estática em `demo/`. Para um projeto Vercel com Root Directory vazio, os comandos e a saída são definidos pelo arquivo. Se o projeto existente usa Root Directory `demo`, o arquivo `demo/vercel.json` atende essa configuração; mantenha habilitada a inclusão dos arquivos externos à raiz.

A branch de demonstração do repositório é `demo/vercel`. O push nessa branch solicita o deploy à integração Git da Vercel, quando configurada. A branch de produção e o resultado do deploy precisam ser conferidos no painel da Vercel; os arquivos do repositório não comprovam essa configuração.

Para conferir localmente: `npm ci --prefix demo`, `npm run build --prefix demo` e `npm run preview --prefix demo`. A exportação usa exclusivamente os exemplos fictícios do painel. Os caminhos `/app`, `/app/perfil` e `/app/perfil/editar` também ficam em demonstração somente leitura; a preferência antiga `folga-data-mode=real` não libera dados pessoais. As APIs pessoais da aplicação completa retornam 503 antes de consultar autenticação ou banco. A demo estática não inclui backend nem banco.

Todas as rotas públicas têm fallback para a aplicação estática; os arquivos de imagens e fontes mantêm seus caminhos originais.
