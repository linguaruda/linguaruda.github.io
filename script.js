(function () {
  'use strict';

  var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxIsIQJOmZfvFm11FKBgbQ6ZUPk4QQbFmZzbA2jkIvKnDFXrZBF_cfnsQPDUwmKwL8w/exec';

  var GA4_ID = 'G-DQ5309P9RR';

  // Só esses eventos viram uma linha na planilha "Linguaruda - Eventos" — os
  // demais (mais frequentes/granulares) vão só para o GA4, que foi feito pra
  // esse volume. Ajuste essa lista se quiser ver mais coisa direto na planilha.
  var EVENTOS_PARA_PLANILHA = ['whatsapp_click', 'chronicle_open', 'chronicle_completed', 'device_info'];

  // ---------- Analytics (GA4 + espelho seletivo na planilha) ----------
  function iniciarGA4() {
    if (!GA4_ID || GA4_ID.indexOf('XXXX') !== -1) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  // `extra` são parâmetros adicionais estruturados, só pro GA4 (a planilha só
  // guarda o texto plano de `detalhe`, uma coluna só).
  function track(nome, detalhe, extra) {
    if (window.gtag) {
      var params = { detalhe: detalhe || '' };
      if (extra) { for (var k in extra) { params[k] = extra[k]; } }
      gtag('event', nome, params);
    }
    if (EVENTOS_PARA_PLANILHA.indexOf(nome) === -1) return;
    // Fogo-e-esqueço: não precisamos ler a resposta, então `no-cors` evita
    // qualquer dependência de CORS estar configurado no lado do Apps Script.
    var url = API_BASE_URL + '?action=log&evento=' + encodeURIComponent(nome) + '&detalhe=' + encodeURIComponent(detalhe || '');
    try { fetch(url, { mode: 'no-cors' }); } catch (err) {}
  }

  // ---------- Config dinâmica (status da pré-venda) ----------
  // Via JSONP (script tag) em vez de fetch — funciona independente de CORS,
  // já que o Apps Script está em outro domínio. A página já renderiza com o
  // preço/benefício de pré-venda visíveis por padrão (caso mais comum); essa
  // chamada só corrige caso a pré-venda já tenha encerrado.
  function carregarConfig() {
    var cbNome = 'linguarudaConfig_' + Date.now();
    window[cbNome] = function (dados) {
      aplicarConfig(dados);
      delete window[cbNome];
      tag.remove();
    };
    var tag = document.createElement('script');
    tag.src = API_BASE_URL + '?action=config&callback=' + cbNome;
    document.body.appendChild(tag);
  }

  function aplicarConfig(dados) {
    document.querySelectorAll('[data-preco-atual]').forEach(function (el) { el.textContent = dados.preco; });
    document.querySelectorAll('[data-preco-lancamento]').forEach(function (el) { el.textContent = dados.precoLancamento; });
    document.querySelectorAll('.pre-venda-only').forEach(function (el) { el.hidden = !dados.preVendaAtiva; });
  }

  // ---------- Livro folheável (iframe isolado — ver flipbook.js) ----------
  // Roda isolado de propósito, num <iframe>: evita um bug sem correção
  // oficial da lib (page-flip) de rolagem automática da página ao virar no
  // celular (github.com/Nodlik/StPageFlip issue #38). A página principal só
  // dimensiona o iframe (altura calculada lá dentro) e repassa os eventos de
  // analytics pro GA4/planilha que já estão configurados aqui.
  function iniciarFlipbookFrame() {
    var frame = document.getElementById('flipbook-frame');
    if (!frame) return;
    window.addEventListener('message', function (evento) {
      if (evento.origin !== window.location.origin) return;
      var dados = evento.data;
      if (!dados || dados.origem !== 'linguaruda-flipbook') return;
      if (dados.tipo === 'altura') {
        frame.style.height = dados.altura + 'px';
      } else if (dados.tipo === 'evento') {
        track(dados.nome, dados.detalhe, dados.extra);
      }
    });
  }

  // ---------- Scroll reveal ----------
  function iniciarScrollReveal() {
    var alvos = document.querySelectorAll('.reveal');
    if (!alvos.length) return;
    if (!window.IntersectionObserver) {
      alvos.forEach(function (el) { el.classList.add('visivel'); });
      return;
    }
    var observer = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visivel');
          observer.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.15 });
    alvos.forEach(function (el) { observer.observe(el); });
  }

  // ---------- Parallax sutil (capa do hero + cenário decorativo de fundo) ----------
  function iniciarParallax() {
    var capa = document.getElementById('capa-hero');
    var fundos = document.querySelectorAll('.fundo-decorativo__texto');
    if (!capa && !fundos.length) return;
    var ticking = false;
    function atualizar() {
      var y = window.scrollY;
      if (capa) {
        // A imagem tem scale(1.18) no CSS — sobra ~9% de margem de cada lado
        // para mover sem revelar borda. Usamos 6% para folga segura.
        var folga = capa.parentElement.getBoundingClientRect().height * 0.06;
        var desloc = Math.min(y * 0.2, folga);
        capa.style.transform = 'scale(1.18) translateY(' + desloc + 'px)';
      }
      fundos.forEach(function (el) {
        el.style.transform = 'translateY(' + (y * -0.08) + 'px)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(atualizar);
        ticking = true;
      }
    }, { passive: true });
  }

  // ---------- Efeito cortina (capa + foto da autora) ----------
  function iniciarCortinas() {
    var alvos = document.querySelectorAll('.cortina');
    if (!alvos.length) return;
    if (!window.IntersectionObserver) {
      alvos.forEach(function (el) { el.classList.add('revelada'); });
      return;
    }
    var observer = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('revelada');
          observer.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.2 });
    alvos.forEach(function (el) { observer.observe(el); });
  }

  // ---------- Sublinhado gradual: sublinha ao cruzar 2/3 da tela (vindo de
  // baixo), dessublinha ao cruzar 1/10 do topo ----------
  function iniciarGrifos() {
    var alvos = document.querySelectorAll('.grifo');
    if (!alvos.length) return;
    var ticking = false;
    function atualizar() {
      var vh = window.innerHeight;
      var pontoAtivacao = vh * 2 / 3;
      var pontoDesativacao = vh * 0.1;
      alvos.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var centro = rect.top + rect.height / 2;
        el.classList.toggle('grifo--ativo', centro >= pontoDesativacao && centro <= pontoAtivacao);
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(atualizar);
        ticking = true;
      }
    }, { passive: true });
    atualizar();
  }

  // ---------- Entrada "pop" (ícones de benefício + cards de depoimento) ----------
  // Não depende de hover — funciona igual em touch, disparado ao entrar na tela.
  function iniciarPop() {
    var grupos = [document.querySelectorAll('.beneficios__icone'), document.querySelectorAll('.depoimento')];
    grupos.forEach(function (lista) {
      if (!lista.length) return;
      if (!window.IntersectionObserver) {
        lista.forEach(function (el) { el.classList.add('pop'); });
        return;
      }
      var observer = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (entrada.isIntersecting) {
            var indice = Array.prototype.indexOf.call(lista, entrada.target);
            setTimeout(function () { entrada.target.classList.add('pop'); }, indice * 90);
            observer.unobserve(entrada.target);
          }
        });
      }, { threshold: 0.3 });
      lista.forEach(function (el) { observer.observe(el); });
    });
  }

  // ---------- FAQ (expansível customizado, com altura animada) ----------
  function iniciarFAQ() {
    document.querySelectorAll('.faq-item__pergunta').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var item = botao.closest('.faq-item');
        var aberto = item.getAttribute('data-aberto') === 'true';
        var novoEstado = !aberto;
        item.setAttribute('data-aberto', novoEstado ? 'true' : 'false');
        botao.setAttribute('aria-expanded', novoEstado ? 'true' : 'false');
        var pergunta = botao.textContent.replace(/\+\s*$/, '').replace(/\s+/g, ' ').trim();
        track('faq_toggle', pergunta + ' — ' + (novoEstado ? 'abriu' : 'fechou'), {
          pergunta: pergunta, aberto: novoEstado
        });
      });
    });
  }

  // ---------- Tempo de permanência por seção ----------
  // Mede quanto tempo cada <section data-secao-nome> fica pelo menos 50%
  // visível na tela e manda o total acumulado quando a aba é minimizada/
  // fechada/trocada. Usamos `visibilitychange` (não `beforeunload`) porque é
  // o único gatilho confiável em mobile (Safari/iOS não dispara beforeunload
  // de forma consistente).
  function iniciarTempoPorSecao() {
    var secoes = document.querySelectorAll('[data-secao-nome]');
    if (!secoes.length || !window.IntersectionObserver) return;
    var estado = {};
    secoes.forEach(function (s) {
      estado[s.getAttribute('data-secao-nome')] = { inicio: null, acumulado: 0 };
    });

    var observer = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        var nome = entrada.target.getAttribute('data-secao-nome');
        var e = estado[nome];
        if (entrada.isIntersecting) {
          e.inicio = Date.now();
        } else if (e.inicio) {
          e.acumulado += (Date.now() - e.inicio) / 1000;
          e.inicio = null;
        }
      });
    }, { threshold: 0.5 });
    secoes.forEach(function (s) { observer.observe(s); });

    function enviarTempos() {
      Object.keys(estado).forEach(function (nome) {
        var e = estado[nome];
        if (e.inicio) {
          e.acumulado += (Date.now() - e.inicio) / 1000;
          e.inicio = null;
        }
        if (e.acumulado >= 1) {
          var segundos = Math.round(e.acumulado);
          track('tempo_secao', nome + ': ' + segundos + 's', { secao: nome, segundos: segundos });
          e.acumulado = 0;
        }
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') enviarTempos();
    });
  }

  // ---------- Info do dispositivo/navegador (uma vez por visita) ----------
  // `userAgentData.getHighEntropyValues` (Client Hints) só existe em
  // navegadores Chromium (Chrome/Edge/Samsung Internet) e é o único jeito de
  // pegar o modelo real do aparelho Android; no Safari/iOS e Firefox não tem
  // equivalente — nesses casos fica só o user-agent genérico mesmo.
  function iniciarDeviceInfo() {
    function resumo(modelo, plataforma) {
      var partes = [];
      if (plataforma) partes.push(plataforma);
      if (modelo) partes.push(modelo);
      partes.push(screen.width + 'x' + screen.height);
      partes.push(navigator.language);
      return partes.join(' · ');
    }
    function enviar(modelo, plataforma) {
      track('device_info', resumo(modelo, plataforma), {
        modelo: modelo || '(nao disponivel)',
        plataforma: plataforma || '(nao disponivel)',
        ua: navigator.userAgent,
        tela: screen.width + 'x' + screen.height,
        dpr: window.devicePixelRatio,
        touch: ('ontouchstart' in window) ? 'sim' : 'nao',
        idioma: navigator.language
      });
    }
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion'])
        .then(function (alta) {
          enviar(alta.model, [alta.platform, alta.platformVersion].filter(Boolean).join(' '));
        })
        .catch(function () { enviar('', ''); });
    } else {
      enviar('', '');
    }
  }

  // ---------- Ripple ao clicar nos botões CTA ----------
  function iniciarRipple() {
    document.querySelectorAll('.cta').forEach(function (botao) {
      botao.addEventListener('click', function (evento) {
        var rect = botao.getBoundingClientRect();
        var tamanho = Math.max(rect.width, rect.height) * 1.4;
        var onda = document.createElement('span');
        onda.className = 'cta__onda';
        onda.style.width = onda.style.height = tamanho + 'px';
        onda.style.left = (evento.clientX - rect.left - tamanho / 2) + 'px';
        onda.style.top = (evento.clientY - rect.top - tamanho / 2) + 'px';
        botao.appendChild(onda);
        onda.addEventListener('animationend', function () { onda.remove(); });
      });
    });
  }

  // ---------- Clique nos botões de WhatsApp ----------
  function iniciarTrackingCliques() {
    document.querySelectorAll('[data-secao-cta]').forEach(function (link) {
      link.addEventListener('click', function () {
        track('whatsapp_click', link.getAttribute('data-secao-cta'));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarGA4();
    carregarConfig();
    iniciarDeviceInfo();
    iniciarTempoPorSecao();
    iniciarFlipbookFrame();
    iniciarTrackingCliques();
    iniciarScrollReveal();
    iniciarParallax();
    iniciarCortinas();
    iniciarGrifos();
    iniciarPop();
    iniciarFAQ();
    iniciarRipple();
  });
})();
