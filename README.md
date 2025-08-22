```md
# Navegador de Odisseia

Jogo 3D construído com React + Three.js. Você controla um barco em um oceano infinito, evita objetos aleatórios e explora um cenário gerado dinamicamente.

Principais características
- Tela inicial com modal de boas-vindas e botão "Jogar".
- Barco com animação de flutuação natural (in-place) e controle via botões/touch/teclado.
- Movimentação lateral em três posições: esquerda, centro, direita; botão "Frente" dá um pequeno avanço visual/boost.
- Objetos (detection: destroços, ilhas pequenas, criaturas) aparecem aleatoriamente à frente.
- Colisão com qualquer objeto encerra a rodada e exibe modal "Você deseja continuar?" — ao confirmar, o jogo reinicia.
- Plataformas/objetos antigos desaparecem gradualmente com fade-out para manter leveza.
- Projetado para ser leve e responsivo — geometrias simples, pixel ratio limitado, sem sombras pesadas.

Como rodar
1. Node 16+ recomendado
2. Instale dependências:
   npm install
3. Rode em desenvolvimento:
   npm start

Arquivos principais
- index.html
- package.json
- src/
  - index.jsx
  - App.jsx
  - Game.jsx
  - styles.css

Melhorias possíveis
- Pooling para objetos (reuso em vez de criar/destruir).
- Mais variedade de obstáculos e animações (creatures animadas).
- Sons ambiente e efeitos sonoros de colisão.
- Contadores/scoreboards e persistência local.

Divirta-se explorando o oceano!
```