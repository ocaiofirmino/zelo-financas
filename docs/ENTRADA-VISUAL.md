# Entrada visual do Zelo

Rotas: `/` apresentação, `/login` entrada, `/cadastro` cadastro, `/demo` demonstração pública e `/app` controle autenticado.

Esta etapa implementa a prévia visual dos formulários. Nenhum e-mail ou senha é enviado ou armazenado. O acesso existente continua em `/signin-with-chatgpt?return_to=%2Fapp`. A autenticação por e-mail será uma etapa separada.

Direção: split stage, mantendo Manrope e a paleta original. O mês e os cofrinhos reais da demonstração são a imagem do produto. Quatro capturas locais mostram mês, cofrinhos, cartão e extrato. Sem pessoas, estatísticas ou depoimentos inventados.

Movimento: entrada coreografada, produto com deslocamento leve, troca gradual entre capturas e transições dos formulários. Há pausa visível, pausa em aba oculta e respeito a prefers-reduced-motion. As imagens são dados fictícios.

Ajustes da direção: no celular, título e ação vêm antes da apresentação para que entrar e cadastrar não fiquem abaixo de um painel alto. O inspetor agrupa o carrossel como um único fragmento; a exceção few-pictures é intencional: há quatro capturas reais selecionáveis em um mesmo painel, sem adicionar imagens alheias ao produto. As bordas pertencem aos controles, campos e camadas da prévia. A ausência de vídeo evita duplicar a demonstração interativa; a imagem em movimento é o próprio carrossel.

## Etapa atual: apenas demonstração

Por decisão do projeto, o cadastro e o login serão integrados ao backend em uma próxima etapa. `lib/app-access.ts` mantém o controle pessoal desabilitado. `/app`, perfil e edição abrem com dados fictícios; preferências antigas de modo pessoal são ignoradas. “Usar meus dados” leva ao cadastro. Não há entrada pelo ChatGPT na interface. Os formulários não enviam nem guardam credenciais.

As APIs financeiras, de cofrinhos e de perfil respondem 503 antes de acessar autenticação ou banco enquanto a liberação estiver desabilitada. Isso também bloqueia sessões locais antigas. A liberação deve acontecer somente após implementar o cadastro, autenticação e sessões próprias do Zelo.
