# Revisão da integração — 18/10/2026

Escopo: histórico e diferenças das branches remotas main, newdesign, demo/vercel, feature/cofrinhos e feature/footer-assinatura; entradas públicas, APIs pessoais, exportação e build estático.

A newdesign contém o frontend atual. O rodapé já está incorporado e os cofrinhos incluem o popup de detalhes da branch de funcionalidade. A demo antiga tem arquivos próprios que conflitam com a implementação atual; na integração, prevalece a versão atual, incluindo os bloqueios pessoais. As branches de funcionalidades são preservadas.

PERSONAL_ACCOUNTS_ENABLED permanece false e força o modo demonstrativo no componente financeiro. As entradas públicas usam exemplos fictícios; a preferência folga-data-mode=real não libera o modo pessoal. Criar, editar, excluir, marcar lançamentos, alterar limites, registrar aportes/retiradas e editar perfil ficam bloqueados. As APIs de finanças, perfil e cofrinhos retornam 503 antes de autenticação e banco. A publicação Vercel compila somente a demo estática.

Verificação executada: lint; testes de acesso, finanças, exportação, cofrinhos, perfil e API de perfil em banco em memória; TypeScript e build de produção da demo. Chromium headless verificou /demo, as vistas de lançamentos, cartões, extrato e cofrinhos, /app, /app/perfil, /app/perfil/editar, /login e /cadastro. Nenhuma chamada /api/ ou erro JavaScript ocorreu. O atalho Ctrl+K não abriu criação; login/cadastro não exibiram campos. A exportação CSV gerou arquivo identificado como demonstração. A checagem dos handlers de acesso usa imports substituídos e não substitui um teste HTTP da aplicação Workers/D1.

Limites: não foi executado pentest com Strix (indisponível), nem validada autenticação real. O código legado de autenticação por cabeçalhos depende de proxy confiável; não basta mudar a flag para liberar contas na Vercel. É necessário implementar sessões verificadas, isolamento por usuário e testes completos antes dessa liberação. O build avisa sobre o tamanho do chunk de ExcelJS. O deploy e a branch de produção da Vercel precisam de confirmação externa; não são comprovados pelo vercel.json.
