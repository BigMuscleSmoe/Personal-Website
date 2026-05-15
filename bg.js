/* ============================================================
   Animated background — aurora flow field + alternates
   Modes: aurora (default) · constellation · lattice
   Tweakable via the toolbar "Tweaks" toggle.
   ============================================================ */
(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ---- sizing ---- */
  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reseed current mode so layout fits new viewport
    const cur = modes[state.mode];
    if (cur && cur.reset) cur.reset();
    // Always resize the WebGL canvas if it exists (so it's ready when toggled)
    if (modes.shader && modes.shader !== cur) modes.shader.reset && modes.shader.reset();
  };
  window.addEventListener('resize', resize);

  /* ---- input ---- */
  const mouse = { x: -9999, y: -9999, active: false };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  }, { passive: true });
  window.addEventListener('mouseleave', () => { mouse.active = false; });

  /* ---- persistent tweak state (edited by host on disk) ---- */
  const TWEAKS = /*EDITMODE-BEGIN*/{
    "mode": "shader"
  }/*EDITMODE-END*/;
  const state = { mode: TWEAKS.mode };

  /* ============================================================ */
  /*  Mode 0: SHADER — WebGL plasma grid (default)                */
  /* ============================================================ */
  const shader = (() => {
    // Dedicated WebGL canvas overlaid behind the 2D canvas so the
    // two rendering contexts don't collide.
    let glCanvas = null;
    let gl = null;
    let program = null;
    let uRes = null, uTime = null;
    let startTime = 0;
    let initialized = false;
    let failed = false;

    const vsSource = `
      attribute vec4 aVertexPosition;
      void main() { gl_Position = aVertexPosition; }
    `;
    const fsSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;

      const float overallSpeed = 0.2;
      const float gridSmoothWidth = 0.015;
      const float axisWidth = 0.05;
      const float majorLineWidth = 0.025;
      const float minorLineWidth = 0.0125;
      const float majorLineFrequency = 5.0;
      const float minorLineFrequency = 1.0;
      const float scale = 5.0;
      const vec4 lineColor = vec4(0.4, 0.2, 0.8, 1.0);
      const float minLineWidth = 0.01;
      const float maxLineWidth = 0.2;
      const float lineSpeed = 1.0 * overallSpeed;
      const float lineAmplitude = 1.0;
      const float lineFrequency = 0.2;
      const float warpSpeed = 0.2 * overallSpeed;
      const float warpFrequency = 0.5;
      const float warpAmplitude = 1.0;
      const float offsetFrequency = 0.5;
      const float offsetSpeed = 1.33 * overallSpeed;
      const float minOffsetSpread = 0.6;
      const float maxOffsetSpread = 2.0;
      const int linesPerGroup = 16;

      #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
      #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
      #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
      #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

      float random(float t) {
        return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
      }
      float getPlasmaY(float x, float horizontalFade, float offset) {
        return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset;
      }

      void main() {
        vec2 fragCoord = gl_FragCoord.xy;
        vec4 fragColor;
        vec2 uv = fragCoord.xy / iResolution.xy;
        vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;

        float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
        float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);

        space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);
        space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * horizontalFade;

        vec4 lines = vec4(0.0);
        vec4 bgColor1 = vec4(0.1, 0.1, 0.3, 1.0);
        vec4 bgColor2 = vec4(0.3, 0.1, 0.5, 1.0);

        for(int l = 0; l < linesPerGroup; l++) {
          float normalizedLineIndex = float(l) / float(linesPerGroup);
          float offsetTime = iTime * offsetSpeed;
          float offsetPosition = float(l) + space.x * offsetFrequency;
          float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
          float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
          float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
          float linePosition = getPlasmaY(space.x, horizontalFade, offset);
          float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0 + drawCrispLine(linePosition, halfWidth * 0.15, space.y);

          float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
          vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
          float circle = drawCircle(circlePosition, 0.01, space) * 4.0;

          line = line + circle;
          lines += line * lineColor * rand;
        }

        fragColor = mix(bgColor1, bgColor2, uv.x);
        fragColor *= verticalFade;
        fragColor.a = 1.0;
        fragColor += lines;

        gl_FragColor = fragColor;
      }
    `;
    const loadShader = (gl, type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const init = () => {
      if (initialized || failed) return;
      glCanvas = document.createElement('canvas');
      glCanvas.id = 'bg-canvas-gl';
      glCanvas.setAttribute('aria-hidden', 'true');
      // Insert just before the 2D canvas so it sits behind it.
      canvas.parentNode.insertBefore(glCanvas, canvas);

      gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('WebGL not supported — falling back to aurora.');
        failed = true;
        glCanvas.remove();
        glCanvas = null;
        state.mode = 'aurora';
        return;
      }

      const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Shader link error:', gl.getProgramInfoLog(program));
        failed = true;
        return;
      }

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1
      ]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'aVertexPosition');
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);

      uRes = gl.getUniformLocation(program, 'iResolution');
      uTime = gl.getUniformLocation(program, 'iTime');
      startTime = performance.now();
      sizeGL();
      initialized = true;
    };

    const sizeGL = () => {
      if (!gl || !glCanvas) return;
      glCanvas.width = Math.floor(w * dpr);
      glCanvas.height = Math.floor(h * dpr);
      glCanvas.style.width = w + 'px';
      glCanvas.style.height = h + 'px';
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    };

    const setVisible = (vis) => {
      if (glCanvas) glCanvas.style.display = vis ? 'block' : 'none';
    };

    const draw = (tMs) => {
      if (!initialized) init();
      if (failed || !gl) return;
      // Clear the 2D layer so the WebGL layer shows through.
      ctx.clearRect(0, 0, w, h);
      gl.useProgram(program);
      gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const reset = () => { sizeGL(); };

    return { draw, reset, setVisible, isFailed: () => failed };
  })();

  /* ============================================================ */
  /*  Mode 1: AURORA — curl-noise flow field with silky trails   */
  /* ============================================================ */
  const aurora = (() => {
    const COUNT = 280;
    let parts = [];
    const seed = () => {
      parts = new Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        parts[i] = {
          x, y, px: x, py: y,
          age: Math.random() * 500,
          maxAge: 360 + Math.random() * 480,
          tone: Math.random(),
        };
      }
    };
    // Cheap, smooth pseudo-noise -> angle
    const field = (x, y, t) => {
      const s = 0.0013;
      return (
        Math.sin(x * s + t * 0.7) +
        Math.cos(y * s * 1.25 - t * 0.55) +
        Math.sin((x + y) * s * 0.55 + t * 0.32)
      ) * Math.PI;
    };
    const draw = (tMs) => {
      if (!parts.length) seed();
      // Trail fade — low alpha = longer ribbons
      ctx.fillStyle = 'rgba(10,10,12,0.055)';
      ctx.fillRect(0, 0, w, h);

      const t = tMs * 0.00018;
      ctx.lineWidth = 1.05;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.px = p.x; p.py = p.y;
        const a = field(p.x, p.y, t);
        const speed = 0.75;
        p.x += Math.cos(a) * speed;
        p.y += Math.sin(a) * speed;

        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 220 * 220) {
            const d = Math.sqrt(d2) || 0.001;
            const f = (1 - d / 220) * 0.55;
            // gentle vortex: mix pull + tangential
            p.x += (dx / d) * f * 0.6 + (-dy / d) * f * 0.4;
            p.y += (dy / d) * f * 0.6 + ( dx / d) * f * 0.4;
          }
        }

        // wrap
        if (p.x < -4) { p.x += w + 8; p.px = p.x; }
        else if (p.x > w + 4) { p.x -= w + 8; p.px = p.x; }
        if (p.y < -4) { p.y += h + 8; p.py = p.y; }
        else if (p.y > h + 4) { p.y -= h + 8; p.py = p.y; }

        // age + respawn for variety
        p.age++;
        if (p.age > p.maxAge) {
          p.x = Math.random() * w; p.y = Math.random() * h;
          p.px = p.x; p.py = p.y;
          p.age = 0; p.tone = Math.random();
        }

        // sin-easing alpha so ribbons fade in/out
        const fade = Math.sin((p.age / p.maxAge) * Math.PI);
        const c = p.tone < 0.5 ? '124,92,255' : '0,212,255';
        ctx.strokeStyle = `rgba(${c},${0.36 * fade})`;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };
    return { draw, reset: seed };
  })();

  /* ============================================================ */
  /*  Mode 2: CONSTELLATION — dots + connecting lines             */
  /* ============================================================ */
  const constellation = (() => {
    const COUNT = 88;
    let parts = [];
    const seed = () => {
      parts = new Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        parts[i] = {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          r: 0.7 + Math.random() * 1.4,
        };
      }
    };
    const draw = () => {
      if (!parts.length) seed();
      ctx.clearRect(0, 0, w, h);

      // soft tinted glow underlay
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.65);
      g.addColorStop(0, 'rgba(124,92,255,0.07)');
      g.addColorStop(0.6, 'rgba(0,212,255,0.025)');
      g.addColorStop(1, 'rgba(10,10,12,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      for (const p of parts) {
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 160 * 160) {
            const d = Math.sqrt(d2) + 0.1;
            p.vx += (dx / d) * 0.045;
            p.vy += (dy / d) * 0.045;
          }
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.985; p.vy *= 0.985;
        // gentle baseline drift
        if (Math.abs(p.vx) < 0.06) p.vx += (Math.random() - 0.5) * 0.04;
        if (Math.abs(p.vy) < 0.06) p.vy += (Math.random() - 0.5) * 0.04;

        if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.fill();
      }

      const LINK = 132;
      ctx.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const d = Math.sqrt(d2);
            const al = (1 - d / LINK) * 0.24;
            ctx.strokeStyle = `rgba(124,92,255,${al})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };
    return { draw, reset: seed };
  })();

  /* ============================================================ */
  /*  Mode 3: LATTICE — warping dot grid, ripples on click        */
  /* ============================================================ */
  const lattice = (() => {
    const SPACING = 38;
    let ripples = [];
    const onClick = (e) => {
      ripples.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (ripples.length > 8) ripples.shift();
    };
    window.addEventListener('click', onClick);
    const draw = (tMs) => {
      // hard clear for crisp dots
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, w, h);

      const T = tMs * 0.00055;
      const cols = Math.ceil(w / SPACING) + 2;
      const rows = Math.ceil(h / SPACING) + 2;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const bx = i * SPACING;
          const by = j * SPACING;

          // noise-driven displacement
          const dx =
            Math.sin(bx * 0.011 + T) * 5.5 +
            Math.cos(by * 0.013 - T * 0.7) * 3.5;
          const dy =
            Math.cos(bx * 0.009 - T * 1.05) * 5.5 +
            Math.sin(by * 0.014 + T * 0.6) * 3;

          let alpha = 0.16;
          let r = 1;
          let col = '255,255,255';

          if (mouse.active) {
            const mx = bx - mouse.x, my = by - mouse.y;
            const md = Math.sqrt(mx * mx + my * my);
            if (md < 170) {
              const f = 1 - md / 170;
              alpha += f * 0.7;
              r += f * 1.4;
              col = f > 0.45 ? '0,212,255' : '124,92,255';
            }
          }

          for (let k = 0; k < ripples.length; k++) {
            const rp = ripples[k];
            const rdx = bx - rp.x, rdy = by - rp.y;
            const rd = Math.sqrt(rdx * rdx + rdy * rdy);
            const wave = rp.age * 4.5;
            const band = Math.abs(rd - wave);
            if (band < 36) {
              const fade = 1 - rp.age / 90;
              const f = (1 - band / 36) * Math.max(fade, 0);
              if (f > 0) {
                alpha += f * 0.65;
                r += f * 1.2;
                col = '0,212,255';
              }
            }
          }

          ctx.fillStyle = `rgba(${col},${Math.min(alpha, 0.95)})`;
          ctx.beginPath();
          ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age++;
        if (ripples[i].age > 90) ripples.splice(i, 1);
      }
    };
    return { draw, reset: () => { ripples = []; } };
  })();

  const modes = { shader, aurora, constellation, lattice };

  /* ---- loop ---- */
  let running = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initial paint after resize
  resize();

  // Make sure WebGL layer visibility matches the starting mode
  if (state.mode === 'shader') {
    // init lazily — first draw call sets it up; ensure visible
    modes.shader.draw(0);
    modes.shader.setVisible(true);
  } else {
    modes.shader.setVisible(false);
  }

  const loop = (t) => {
    if (!running) return;
    const m = modes[state.mode] || aurora;
    m.draw(t);
    requestAnimationFrame(loop);
  };
  if (reduced) {
    // single static-ish frame in constellation mode
    constellation.draw(0);
  } else {
    requestAnimationFrame(loop);
  }

  const switchMode = (next) => {
    if (!modes[next] || next === state.mode) return;
    state.mode = next;
    ctx.clearRect(0, 0, w, h);
    // Show/hide WebGL layer based on mode
    if (shader.setVisible) shader.setVisible(next === 'shader');
    modes[next].reset && modes[next].reset();
  };

  /* ============================================================ */
  /*  Tweaks panel (vanilla — follows host protocol)              */
  /* ============================================================ */
  const setupTweaks = () => {
    let panel = null;

    const buildPanel = () => {
      panel = document.createElement('div');
      panel.className = 'bg-tweaks';
      panel.innerHTML = `
        <div class="bg-tweaks-head">
          <span class="bg-tweaks-title">Tweaks · Background</span>
          <button class="bg-tweaks-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="bg-tweaks-body">
          <div class="bg-tweaks-label">Mode</div>
          <div class="bg-tweaks-modes" role="radiogroup"></div>
          <p class="bg-tweaks-hint">Lattice mode: click anywhere to ripple.</p>
        </div>
      `;
      const grp = panel.querySelector('.bg-tweaks-modes');
      ['shader', 'aurora', 'constellation', 'lattice'].forEach((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bg-tweaks-mode' + (m === state.mode ? ' active' : '');
        b.dataset.mode = m;
        b.textContent = m;
        b.addEventListener('click', () => {
          switchMode(m);
          grp.querySelectorAll('.bg-tweaks-mode').forEach((x) => {
            x.classList.toggle('active', x.dataset.mode === m);
          });
          try {
            window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { mode: m } }, '*');
          } catch (e) { /* noop */ }
        });
        grp.appendChild(b);
      });
      panel.querySelector('.bg-tweaks-close').addEventListener('click', () => {
        panel.style.display = 'none';
        try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
      });
      document.body.appendChild(panel);
    };

    window.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') {
        if (!panel) buildPanel();
        panel.style.display = 'block';
      } else if (d.type === '__deactivate_edit_mode' && panel) {
        panel.style.display = 'none';
      }
    });

    try {
      window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    } catch (e) { /* noop */ }
  };
  setupTweaks();
})();
