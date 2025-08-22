import React, { useState } from "react";
import Game from "./Game";

export default function App(){
  const [started, setStarted] = useState(false);

  return (
    <div className="app">
      <div className="game-area">
        <Game started={started} onRequestStart={() => setStarted(true)} />
      </div>

      {!started && (
        <div className="modal-bg" role="dialog" aria-modal="true">
          <div className="modal">
            <h1>Navegador de Odisseia</h1>
            <p>Explore um oceano infinito. Plataformas suportadas: <strong>PC e Celular</strong>.</p>
            <p>Controles: setas / A D / toques / botões na tela.</p>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => setStarted(true)}>Jogar</button>
              <button className="btn btn-ghost" onClick={() => alert("Use teclado ou toque para controlar o barco.")}>Ajuda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}