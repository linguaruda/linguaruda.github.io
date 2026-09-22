(function () {
  'use strict';

  // Essa página roda isolada dentro de um <iframe> na página principal, de
  // propósito: a lib (page-flip) tem um bug conhecido e sem correção oficial
  // de "auto scroll" da página ao virar no mobile
  // (github.com/Nodlik/StPageFlip issue #38). Confirmamos numa versão antiga
  // hospedada no Apps Script (que carregava o conteúdo num iframe sandboxed)
  // que o bug some quando o livro roda isolado assim — provavelmente porque
  // o scroll indevido acontece dentro do próprio frame, sem afetar a página
  // visível por fora. `postMessage` avisa a página principal da altura real
  // do conteúdo (pra dimensionar o <iframe>) e repassa os eventos de
  // analytics (a página principal já tem o GA4/planilha configurados).
  function enviarParaPai(tipo, dados) {
    if (window.parent === window) return;
    window.parent.postMessage(Object.assign({ origem: 'linguaruda-flipbook', tipo: tipo }, dados), window.location.origin);
  }

  function track(nome, detalhe, extra) {
    enviarParaPai('evento', { nome: nome, detalhe: detalhe, extra: extra });
  }

  function enviarAltura() {
    enviarParaPai('altura', { altura: document.documentElement.scrollHeight });
  }

  // ---------- Efeito de virar página (StPageFlip) ----------
  var libPronta = false;
  var libCallbacks = [];
  function quandoLibPronta_(cb) {
    if (libPronta) { cb(); } else { libCallbacks.push(cb); }
  }
  var libScript = document.getElementById('page-flip-lib');
  if (libScript) {
    libScript.addEventListener('load', function () {
      libPronta = true;
      libCallbacks.forEach(function (cb) { cb(); });
      libCallbacks = [];
    });
  }

  // Monta as páginas de uma crônica automaticamente: mede o espaço real
  // disponível e vai encaixando parágrafos até que o próximo não caiba mais,
  // abrindo uma nova página nesse ponto. Cada crônica sempre começa em uma
  // página nova (o título nunca fica "grudado" no fim da anterior).
  function paginarCronicas_(larguraPagina, alturaPagina) {
    var medidor = document.createElement('div');
    medidor.className = 'flipbook-pagina';
    medidor.style.position = 'fixed';
    medidor.style.visibility = 'hidden';
    medidor.style.left = '-9999px';
    medidor.style.top = '0';
    medidor.style.width = larguraPagina + 'px';
    medidor.style.height = 'auto';
    medidor.style.overflow = 'visible';
    document.body.appendChild(medidor);

    function cabe(nos) {
      medidor.innerHTML = '';
      nos.forEach(function (n) { medidor.appendChild(n.cloneNode(true)); });
      return medidor.scrollHeight <= alturaPagina;
    }

    var paginas = [];
    var atual = [];

    function fecharPagina() {
      if (atual.length) paginas.push(atual);
      atual = [];
    }

    document.querySelectorAll('#cronicas-fonte .cronica-fonte').forEach(function (cronica) {
      fecharPagina(); // cada crônica começa numa página nova

      var titulo = document.createElement('h3');
      titulo.textContent = cronica.getAttribute('data-titulo');
      var marca = document.createElement('p');
      marca.className = 'flipbook-marca';
      marca.setAttribute('aria-hidden', 'true');
      marca.textContent = '❋';

      var blocos = [titulo, marca].concat(Array.from(cronica.querySelectorAll('p')));

      blocos.forEach(function (bloco) {
        var candidato = atual.concat([bloco]);
        if (atual.length > 0 && !cabe(candidato)) {
          fecharPagina();
          atual = [bloco];
        } else {
          atual = candidato;
        }
      });
    });
    fecharPagina();

    medidor.remove();
    return paginas;
  }

  function iniciarFlipbook() {
    var container = document.getElementById('flipbook');
    if (!container || !window.St) return;

    // Reforço, mesmo isolado no iframe: bloqueia o navegador de tratar o
    // toque no livro como rolagem nativa.
    container.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    // Largura útil da página (a mesma coluna de conteúdo, até 480px), calculada
    // aqui em vez de deixar a lib decidir — evita que ela escolha um tamanho
    // maior que a tela disponível (causa overflow horizontal).
    var largura = Math.max(Math.min(container.parentElement.clientWidth, 480), 240);
    var altura = Math.round(largura * 1.5);
    // A lib estica o livro para caber o espaço do pai mesmo com size:'fixed';
    // travamos esse espaço no tamanho calculado para ela não crescer além disso.
    container.parentElement.style.maxWidth = largura + 'px';

    // O medidor usa a própria classe .flipbook-pagina (mesmo padding, mesma
    // fonte) com box-sizing:border-box — largura/altura totais já bastam,
    // não subtrair o padding aqui de novo (senão ele é descontado 2x).
    var paginasTexto = paginarCronicas_(largura, altura);
    paginasTexto.forEach(function (nos) {
      var pagina = document.createElement('div');
      pagina.className = 'flipbook-pagina';
      nos.forEach(function (n) { pagina.appendChild(n); });
      container.appendChild(pagina);
    });

    var pageFlip = new St.PageFlip(container, {
      width: largura,
      height: altura,
      size: 'fixed',
      maxShadowOpacity: 0.4,
      showCover: false,
      usePortrait: true,
      mobileScrollSupport: true,
      // Exige um arraste mais deliberado antes de virar a página — evita que
      // um toque leve ou o início de um scroll vertical seja lido como flip.
      swipeDistance: 45
    });

    pageFlip.loadFromHTML(document.querySelectorAll('#flipbook .flipbook-pagina'));

    var total = pageFlip.getPageCount();
    document.getElementById('pagina-total').textContent = total;

    var abriu = false;
    var terminou = false;
    var paginaAnterior = 1;

    pageFlip.on('flip', function (e) {
      var atual = e.data + 1;
      document.getElementById('pagina-atual').textContent = atual;
      esconderDicaArrastar();

      if (!abriu) { abriu = true; track('chronicle_open'); }
      track('chronicle_page_turn', 'pagina ' + atual + ' de ' + total, {
        pagina: atual, total_paginas: total, direcao: atual > paginaAnterior ? 'avancar' : 'voltar'
      });
      paginaAnterior = atual;
      if (!terminou && atual >= total) { terminou = true; track('chronicle_completed'); }
    });

    enviarAltura();
  }

  function esconderDicaArrastar() {
    var dica = document.getElementById('dica-arrastar');
    if (dica) dica.classList.add('escondida');
  }

  document.addEventListener('DOMContentLoaded', function () {
    quandoLibPronta_(iniciarFlipbook);
  });

  // A largura do iframe muda com o layout responsivo da página principal —
  // refaz a altura reportada quando isso acontece.
  window.addEventListener('resize', function () {
    if (document.getElementById('pagina-total').textContent !== '–') enviarAltura();
  });
})();
