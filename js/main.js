/* Diamond Beauty Brasil — homepage motion */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';

  /* ---------- menu mobile ---------- */
  const nav = document.querySelector('.nav');
  const burger = document.querySelector('.nav__burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  nav.querySelectorAll('.nav__mobile a').forEach(a => a.addEventListener('click', () => {
    if (nav.classList.contains('is-open')) burger.click();
  }));

  /* botão de marcação no ecrã tátil: o toque faz o efeito do hover e só depois abre a chamada */
  const bookBtn = document.querySelector('.btn-book');
  if (bookBtn && window.matchMedia('(hover: none)').matches) {
    let bookTimer;
    const bookOff = () => { clearTimeout(bookTimer); bookBtn.classList.remove('is-touched'); };
    bookBtn.addEventListener('pointerdown', () => { clearTimeout(bookTimer); bookBtn.classList.add('is-touched'); });
    bookBtn.addEventListener('pointercancel', bookOff);   // afinal era scroll
    bookBtn.addEventListener('click', e => {
      e.preventDefault();
      bookBtn.classList.add('is-touched');
      setTimeout(() => { window.location.href = bookBtn.href; }, 450);
      bookTimer = setTimeout(bookOff, 1600);
    });
  }

  /* nav fixo: ganha fundo assim que sai do topo do hero */
  // o Safari pinta a zona da Dynamic Island com a theme-color: acompanha o fundo da barra
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const navScrolled = () => {
    const scrolled = nav.classList.toggle('is-scrolled', window.scrollY > 40);
    themeColor.content = scrolled ? '#FBFAF8' : '#D8D7D5';
    document.body.classList.toggle('at-top', !scrolled);
  };
  window.addEventListener('scroll', navScrolled, { passive: true });
  navScrolled();

  /* ---------- seda a ondular (WebGL) ----------
     A imagem do fundo é distorcida por ondas lentas de seno e atravessada
     por um brilho suave. Se não houver WebGL, fica a imagem estática por baixo. */
  const hero = document.querySelector('.hero');
  const canvas = document.querySelector('.hero__flow');

  function initFlow() {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const vs = `
      attribute vec2 p;
      varying vec2 v;
      void main() { v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
    const fs = `
      precision mediump float;
      varying vec2 v;
      uniform sampler2D tex;
      uniform float time;
      uniform vec2 cover;
      void main() {
        vec2 uv = (v - .5) * cover / 1.06 + .5;          // object-fit: cover + margem para as ondas
        float t = time;
        uv.x += .012 * sin(uv.y * 4.6 + t * .50) + .006 * sin(uv.y * 9.2 - t * .37);
        uv.y += .010 * cos(uv.x * 3.8 - t * .42) + .005 * sin(uv.x * 8.1 + t * .31);
        vec3 c = texture2D(tex, uv).rgb;
        float sheen = sin((uv.x * 1.2 + uv.y) * 3.2 - t * .28);
        c += .035 * smoothstep(.55, 1., sheen);            // brilho a passar pela seda
        gl_FragColor = vec4(c, 1.);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const prog = gl.createProgram();
    const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return;
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'time');
    const uCover = gl.getUniformLocation(prog, 'cover');
    const IMG_RATIO = 1920 / 1080;

    function resize() {
      // o fundo é desfocado: resolução 1× chega e poupa GPU
      const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const r = w / h;
      gl.uniform2f(uCover, r > IMG_RATIO ? 1 : r / IMG_RATIO, r > IMG_RATIO ? IMG_RATIO / r : 1);
    }

    const img = new Image();
    img.src = 'assets/hero-bg.webp';
    img.decode().then(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

      resize();
      window.addEventListener('resize', resize);

      const draw = t => { gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
      draw(0);
      canvas.classList.add('is-ready');
      if (reduce) return;                       // reduzir movimento: fica a primeira frame, parada

      // só anima com o hero visível e o separador ativo
      let visible = true, raf = 0;
      const start = performance.now();
      const SPEED = 1.35;                      // velocidade da ondulação (1 = original)
      const loop = now => { draw((now - start) / 1000 * SPEED); raf = requestAnimationFrame(loop); };
      const sync = () => {
        cancelAnimationFrame(raf);
        if (visible && !document.hidden) raf = requestAnimationFrame(loop);
      };
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(hero);
      document.addEventListener('visibilitychange', sync);
    }).catch(() => {});
  }
  initFlow();

  /* ---------- preçário: separadores ---------- */
  const tabs = [...document.querySelectorAll('.ptab')];
  function selectTab(key, focus = false) {
    tabs.forEach(t => {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on) {
        t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (focus) t.focus();
      }
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true);
    });
  });
  // cada serviço abre o preçário já no separador certo
  document.querySelectorAll('.svc__link').forEach(a => a.addEventListener('click', () => selectTab(a.dataset.tab)));

  /* ---------- galeria: botões + arrastar com o rato ---------- */
  const track = document.querySelector('.work__track');
  document.querySelectorAll('.work__nav .round-btn').forEach(b => b.addEventListener('click', () => {
    if (track.classList.contains('is-marquee')) return;   // no carril contínuo os botões dão um empurrão (mais abaixo)
    const item = track.querySelector('.work__item');
    track.scrollBy({ left: +b.dataset.dir * (item.offsetWidth + 20) * 2, behavior: reduce ? 'auto' : 'smooth' });
  }));
  let drag = null;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || track.classList.contains('is-marquee')) return;   // no touch o scroll nativo já é perfeito
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { drag.moved = true; track.classList.add('is-dragging'); }
    track.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    track.classList.remove('is-dragging');     // devolve o snap: assenta na foto mais próxima
  });

  if (!hasGsap || reduce) return;

  /* ---------- entrada ---------- */
  gsap.registerPlugin(ScrollTrigger);

  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo('.hero__media',
      { clipPath: 'inset(20% 30% 24% 30% round 14px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.7, ease: 'expo.inOut' })
    // a seda afasta-se com o frame; a mulher e o lettering entram logo a seguir, em profundidade
    .fromTo('.hero__layer--bg', { scale: 1.3 }, { scale: 1, duration: 1.9, ease: 'expo.inOut' }, 0)
    .fromTo('.hero__layer--model', { scale: 1.12, yPercent: 4 }, { scale: 1, yPercent: 0, duration: 2, ease: 'expo.inOut' }, 0)
    .fromTo('.hero__mark', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.6 }, 1.1)
    .fromTo('[data-intro]', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: .12, clearProps: 'transform' }, 1.3); // sem transform residual: o menu mobile é position:fixed

  /* ---------- parallax com o rato: o fundo afasta-se, a mulher aproxima-se ---------- */
  if (finePointer) {
    const layers = [
      ['.hero__layer--bg',    -14],
      ['.hero__layer--mark',   -6],
      ['.hero__layer--model',   8],
    ].map(([sel, depth]) => ({
      depth,
      x: gsap.quickTo(sel, 'x', { duration: 1.4, ease: 'power3.out' }),
      y: gsap.quickTo(sel, 'y', { duration: 1.4, ease: 'power3.out' }),
    }));
    hero.addEventListener('pointermove', e => {
      const nx = e.clientX / window.innerWidth - .5;
      const ny = e.clientY / window.innerHeight - .5;
      layers.forEach(l => { l.x(nx * l.depth * 2); l.y(ny * l.depth); });
    });
    hero.addEventListener('pointerleave', () => layers.forEach(l => { l.x(0); l.y(0); }));
  }

  /* ---------- scroll ---------- */
  // ao descer, o lettering desce mais devagar que a página: reforça as camadas
  gsap.to('.hero__mark', {
    yPercent: 45, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .6 }
  });

  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.from(el, {
      y: 48, opacity: 0, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* ---------- galeria: carril contínuo ----------
     Corre sozinho para a esquerda. O scroll da página acelera-o (para cima, inverte) e
     inclina os cartões; o rato por cima abranda-o; arrasta-se com inércia. */
  {
    const rail = track.querySelector('.work__rail');
    [...rail.children].forEach(el => {          // segunda cópia para o laço não ter fim
      const c = el.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('img').forEach(i => { i.alt = ''; });
      rail.appendChild(c);
    });
    track.classList.add('is-marquee');
    const items = rail.querySelectorAll('.work__item');
    const videos = rail.querySelectorAll('video');
    const setX = gsap.quickSetter(rail, 'x', 'px');
    const setSkew = gsap.quickSetter(items, 'skewX', 'deg');
    let half = 0;
    const measure = () => { half = rail.scrollWidth / 2; };
    measure();
    window.addEventListener('resize', measure);

    const BASE = 70;                              // px/s em repouso
    const st = { hover: 1 };
    let x = 0, vel = 0, boost = 0, skew = 0, inView = false, drag = null;

    ScrollTrigger.create({
      trigger: track, start: 'top bottom', end: 'bottom top',
      onUpdate: self => { boost = gsap.utils.clamp(-3000, 3000, self.getVelocity()); }
    });
    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      videos.forEach(v => { if (inView) v.play().catch(() => {}); else v.pause(); });
    }).observe(track);

    if (finePointer) {
      track.addEventListener('mouseenter', () => gsap.to(st, { hover: .45, duration: .8, ease: 'power2.out' }));
      track.addEventListener('mouseleave', () => gsap.to(st, { hover: 1, duration: .8, ease: 'power2.out' }));
    }

    // o arrastar só "agarra" o carril depois de o ponteiro andar uns píxeis,
    // e solta-se em qualquer saída (soltar, cancelar, perder o foco) para nunca ficar preso
    let press = null;
    track.addEventListener('dragstart', e => e.preventDefault());
    track.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      press = { id: e.pointerId, x0: e.clientX, start: x, last: e.clientX, t: performance.now() };
    });
    track.addEventListener('pointermove', e => {
      if (!press || e.pointerId !== press.id) return;
      if (!drag && Math.abs(e.clientX - press.x0) > 6) {
        drag = press; drag.start = x - (e.clientX - press.x0); drag.v = 0; vel = 0;
        try { track.setPointerCapture(e.pointerId); } catch (_) {}
        track.classList.add('is-dragging');
      }
      if (!drag) return;
      const now = performance.now();
      drag.v = (e.clientX - drag.last) / Math.max(1, now - drag.t) * 1000;
      drag.last = e.clientX; drag.t = now;
      x = drag.start + (e.clientX - drag.x0);
    });
    const release = () => {
      if (drag) vel = -gsap.utils.clamp(-2500, 2500, drag.v);   // a inércia continua o gesto
      drag = press = null;
      track.classList.remove('is-dragging');
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => track.addEventListener(t, release));
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);

    // scroll lateral (trackpad, rato com roda horizontal, shift+roda) também move o carril
    track.addEventListener('wheel', e => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (!dx) return;
      e.preventDefault();
      x -= dx; vel = 0;
    }, { passive: false });

    const nudge = dir => { vel += dir * 1100; };
    document.querySelectorAll('.work__nav .round-btn').forEach(b => b.addEventListener('click', () => nudge(+b.dataset.dir)));
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') nudge(1);
      if (e.key === 'ArrowLeft') nudge(-1);
    });

    gsap.ticker.add((time, dt) => {
      if (!inView || !half) return;
      const k = dt / 16.67;
      boost *= Math.pow(.92, k);
      vel *= Math.pow(.95, k);
      const speed = BASE * st.hover + boost * .3 + vel;
      if (!drag) x -= speed * dt / 1000;
      x = gsap.utils.wrap(-half, 0, x);
      setX(x);
      skew += (gsap.utils.clamp(-5, 5, -speed / 160) - skew) * .1;
      setSkew(skew);
    });
  }

  /* ---------- botão de marcação: magnético ---------- */
  if (finePointer) {
    const btn = document.querySelector('.btn-book');
    const bx = gsap.quickTo(btn, 'x', { duration: .6, ease: 'power3.out' });
    const by = gsap.quickTo(btn, 'y', { duration: .6, ease: 'power3.out' });
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      bx((e.clientX - r.left - r.width / 2) * .25);
      by((e.clientY - r.top - r.height / 2) * .35);
    });
    btn.addEventListener('pointerleave', () => { bx(0); by(0); });
  }

  // a sacola abre-se: a janela cresce e a foto recua até à escala normal, nunca para lá da largura real
  const bagImg = document.querySelector('.ritual__media img');
  const bagOpen = { trigger: '.ritual', start: 'top 85%', end: () => `top ${-.1 * window.innerHeight}`, scrub: .5, invalidateOnRefresh: true };
  gsap.fromTo('.ritual__media',
    { clipPath: () => window.innerWidth <= 600 ? 'inset(32% 16% 32% 16% round 20px)' : 'inset(24% 32% 24% 32% round 20px)' },
    { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: bagOpen });
  gsap.fromTo(bagImg,
    { scale: () => gsap.utils.clamp(1, 1.18, 1800 / Math.max(bagImg.offsetWidth, bagImg.offsetHeight * 1800 / 1344)) },
    { scale: 1, ease: 'none', scrollTrigger: bagOpen });

  // entradas em cascata para as grelhas
  ['.work__item', '.member'].forEach(sel => {
    gsap.set(sel, { y: 40, opacity: 0 });
    ScrollTrigger.batch(sel, {
      start: 'top 88%', once: true,
      onEnter: els => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .08 })
    });
  });

  /* ---------- serviços: foto a seguir o cursor ---------- */
  if (finePointer) {
    const list = document.querySelector('.svc-list');
    const preview = document.querySelector('.svc-preview');
    const pImg = preview.querySelector('img');
    const pVid = preview.querySelector('video');
    const px = gsap.quickTo(preview, 'x', { duration: .7, ease: 'power3.out' });
    const py = gsap.quickTo(preview, 'y', { duration: .7, ease: 'power3.out' });
    let shown = false;

    const lane = list.querySelector('.svc__lane');
    const place = (e, instant) => {
      // a foto desliza na faixa vazia entre o nome e a descrição: nunca tapa texto
      const r = lane.getBoundingClientRect();
      const x = r.left + (r.width - preview.offsetWidth) / 2 + (e.clientX - (r.left + r.width / 2)) * .05;
      const y = e.clientY - preview.offsetHeight / 2;
      if (instant) gsap.set(preview, { x, y });
      px(x); py(y);
    };
    const show = on => {
      if (on === shown) return;
      shown = on;
      // overwrite: sem isto, entrar e sair depressa deixa as duas animações a correr
      // e a de entrada (mais longa) acaba por deixar a foto presa visível.
      // 'auto' e não true: true matava também os quickTo de x/y e a foto deixava de seguir o cursor
      gsap.to(preview, { opacity: on ? 1 : 0, scale: on ? 1 : .85, duration: on ? .5 : .3, ease: on ? 'expo.out' : 'power2.in', overwrite: 'auto' });
      if (!on) pVid.pause();
    };

    let current = null;
    const activate = (li, e) => {
      current = li;
      const src = li && li.dataset.media;
      if (!src) return show(false);
      const isVideo = src.endsWith('.mp4');
      preview.classList.toggle('is-video', isVideo);
      if (isVideo) {
        if (!pVid.src) pVid.src = src;
        pVid.play().catch(() => {});
      } else {
        pVid.pause();
        pImg.src = src;
        gsap.fromTo(pImg, { scale: 1.15 }, { scale: 1, duration: .8, ease: 'expo.out' });
      }
      if (!shown) place(e, true);
      show(true);
    };
    // decide pelo que está mesmo debaixo do cursor: no Safari, rodar o trackpad
    // não dispara eventos do rato, e a foto ficava presa a descer com a página
    let pointer = null;
    const sync = () => {
      if (!pointer) { current = null; return show(false); }
      const el = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const li = el && el.closest('.svc');
      if (!li || !list.contains(li)) { current = null; return show(false); }
      if (li !== current) activate(li, pointer);
      else if (shown) place(pointer);
    };
    window.addEventListener('pointermove', e => {
      pointer = { clientX: e.clientX, clientY: e.clientY };
      if (shown || list.contains(e.target)) sync();
    }, { passive: true });
    window.addEventListener('scroll', () => { if (shown) sync(); }, { passive: true });
    list.addEventListener('pointerleave', () => { current = null; show(false); });
    document.addEventListener('mouseleave', () => { pointer = null; current = null; show(false); });
  }
})();
