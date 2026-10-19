# Movimento no Zelo

## Revisão

A entrada tinha uma composição animada, mas o aplicativo trocava suas áreas sem transição de conteúdo. As barras já tinham transições de largura, porém surgiam no valor final; o gráfico não era desenhado e a seleção lateral apenas trocava de cor.

## Implementação

- Transições de conteúdo com View Transitions quando disponíveis. A navegação continua funcional em outros navegadores. Cliques rápidos cancelam a apresentação anterior e preservam o último destino.
- Seleção lateral, abas móveis e seletor da apresentação com indicador deslizante. A medida acompanha redimensionamento e carregamento de fontes.
- IntersectionObserver revela blocos quando entram no campo de visão. As animações variam entre títulos, superfícies, cartões e linhas. Não há um estado CSS que deixe conteúdo oculto à espera de JavaScript.
- Desenho progressivo do gráfico, revelação da previsão e crescimento das barras. Os valores finais e os textos acessíveis continuam sendo os reais da demonstração.
- Foto de perfil e mensagens de confirmação com feedback de entrada. Controles recebem resposta de pressão e os cartões dos cofrinhos respondem ao ponteiro.
- Na apresentação, a prévia acompanha levemente o mouse em dispositivos com ponteiro preciso; a pausa interrompe essa resposta e o movimento ambiente.

## Durações e acessibilidade

Resposta de controles em 180–260 ms; seleção em 480 ms; blocos e linhas em 440–650 ms; gráfico em 1300 ms. O efeito para em movimento reduzido, evita listeners de rolagem e libera as animações após concluir. Nenhuma ação exige esperar uma animação terminar.

A referência é `apple-design/references/hig/motion.md`, especialmente Best practices e Providing feedback: movimento com propósito, opcional e breve. A coreografia e os tempos são decisões de design para o Zelo.
