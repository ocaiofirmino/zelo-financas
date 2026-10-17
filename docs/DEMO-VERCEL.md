# Novo design na Vercel

A branch `newdesign` inclui início, login e cadastro visuais, dashboard, perfil e cofrinhos com dados fictícios. O cadastro não cria contas e nenhuma informação pessoal é enviada. As APIs pessoais continuam bloqueadas até a integração do backend.

O `vercel.json` na raiz instala e compila a versão estática em `demo/`. Para um projeto Vercel com Root Directory vazio, os comandos e a saída são definidos pelo arquivo. Se o projeto existente usa Root Directory `demo`, o arquivo `demo/vercel.json` atende essa configuração; mantenha habilitada a inclusão dos arquivos externos à raiz.

A integração GitHub da Vercel pode gerar uma prévia ao receber o push em `newdesign`. Publicar em produção depende da branch de produção configurada no painel. Esta entrega não altera essa configuração nem a branch `main`.

Para conferir localmente: `npm ci --prefix demo`, `npm run build --prefix demo` e `npm run preview --prefix demo`. Todas as rotas públicas têm fallback para a aplicação estática; os arquivos de imagens e fontes mantêm seus caminhos originais.
