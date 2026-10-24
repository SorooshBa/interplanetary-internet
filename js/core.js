/*
 * core.js — namespace, constants, shared formatting, ticker and shared UI
 * components for The Interplanetary Internet.
 *
 * Everything hangs off one global namespace: window.IPI.
 * No modules (the site must work from file://), no optional chaining,
 * no nullish coalescing.
 */
(function () {
  'use strict';

  var IPI = (window.IPI = window.IPI || {});

  /* ------------------------------------------------------------------ *
   * Constants (Section 4.1)
   * ------------------------------------------------------------------ */

  IPI.CONST = {
    C_KM_S: 299792.458, // speed of light in vacuum, km/s
    AU_KM: 149597870.7,
    LY_KM: 9460730472580.8, // = C_KM_S * YEAR_S
    DAY_S: 86400,
    YEAR_S: 31557600, // Julian year (365.25 days)
    EARTH_EQUATOR_KM: 40075,
    LIGHT_LAPS_PER_SECOND: 299792.458 / 40075,
    FIBER_INDEX: 1.4682,
    COAX_VELOCITY_FACTOR: 0.66,
    PING_TIMEOUT_S: 10
  };

  /* ------------------------------------------------------------------ *
   * Speed multiplier list (Section 2.3)
   * ------------------------------------------------------------------ */

  IPI.SPEEDS = [1, 2, 4, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000];
  IPI.SPEED_LABELS = ['1×', '2×', '4×', '10×', '100×', '1K×', '10K×', '100K×', '1M×', '10M×', '100M×'];
  IPI.SPEED_TITLES = [
    '1× (real time)', '2×', '4×', '10×', '100×', '1,000×', '10,000×',
    '100,000×', '1,000,000×', '10,000,000×', '100,000,000×'
  ];

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  var util = (IPI.util = {});

  util.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  /** Only rewrite textContent when the string actually changed (perf). */
  util.setText = function (el, text) {
    if (!el) return;
    if (el.__ipiText !== text) {
      el.__ipiText = text;
      el.textContent = text;
    }
  };

  /** Toggle an attribute value only when it changed. */
  util.setAttr = function (el, name, value) {
    if (!el) return;
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  };

  util.reducedMotion = function () {
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  };

  /**
   * Observe an element and call cb(isVisible) when it enters/leaves the
   * viewport. Falls back to "always visible" when IntersectionObserver is
   * missing. Threshold 0.01 as specified in Section 2.1.
   */
  util.observeVisible = function (el, cb) {
    if (typeof IntersectionObserver === 'undefined') {
      cb(true);
      return { disconnect: function () {} };
    }
    var obs = new IntersectionObserver(
      function (entries) {
        cb(entries[0].isIntersecting);
      },
      { threshold: 0.01 }
    );
    obs.observe(el);
    return obs;
  };

  /**
   * Canvas helper: handles devicePixelRatio (capped at 2), resize via
   * ResizeObserver (fallback: window.resize) and visibility tracking.
   * Returns { ctx, w, h, isVisible, realSeconds }.
   */
  util.canvas = function (canvas) {
    var ctx = canvas.getContext('2d');
    var obj = {
      canvas: canvas,
      ctx: ctx,
      w: 0,
      h: 0,
      isVisible: true,
      realSeconds: 0,
      dpr: 1
    };

    obj.resize = function () {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      obj.w = w;
      obj.h = h;
      obj.dpr = dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    obj.resize();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        obj.resize();
      });
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', function () {
        obj.resize();
      });
    }

    util.observeVisible(canvas, function (visible) {
      obj.isVisible = visible;
    });

    return obj;
  };

  /* ------------------------------------------------------------------ *
   * Physics helpers (pure; shared by widgets and the test page)
   * ------------------------------------------------------------------ */

  var physics = (IPI.physics = {});

  /** epsilon = 1 - beta; gamma = 1 / sqrt(eps * (2 - eps)). */
  physics.gammaOf = function (epsilon) {
    if (epsilon >= 1) return 1; // at rest
    return 1 / Math.sqrt(epsilon * (2 - epsilon));
  };

  /** Kinetic energy in joules: (gamma - 1) * m * c^2. */
  physics.keOf = function (gamma, massKg) {
    var c = 299792458;
    return (gamma - 1) * massKg * c * c;
  };

  /**
   * Energy-wall slider: s in [0,1] -> epsilon = 10^(-12 s).
   * s = 0 is handled explicitly (beta 0, gamma 1, KE 0).
   */
  physics.wall = function (s) {
    if (s <= 0) {
      return { epsilon: 1, beta: 0, gamma: 1, ke: 0 };
    }
    var epsilon = Math.pow(10, -12 * s);
    var beta = 1 - epsilon;
    var gamma = physics.gammaOf(epsilon);
    var ke = physics.keOf(gamma, 1);
    return { epsilon: epsilon, beta: beta, gamma: gamma, ke: ke };
  };

  /** Mars orbit schematic angle (circular model, Section 8.3.5). */
  physics.marsTheta = function (marsT) {
    var dc = 0.524 + 2 * marsT; // AU
    var arg = (1 + 1.524 * 1.524 - dc * dc) / (2 * 1.524);
    // Clamp to [-1, 1]; snap values within FP noise of the bounds so the
    // geometric extremes give exactly 0 and π.
    if (arg >= 1 - 1e-12) arg = 1;
    if (arg <= -1 + 1e-12) arg = -1;
    return Math.acos(util.clamp(arg, -1, 1));
  };

  /** Relativistic velocity addition, in units of c: u_A = (u' + v) / (1 + v·u'). */
  physics.relAdd = function (u, v) {
    return (u + v) / (1 + v * u);
  };

  /* ------------------------------------------------------------------ *
   * Formatting (Section 3) — exact algorithms
   * ------------------------------------------------------------------ */

  var fmt = (IPI.fmt = {});

  /** 3.1 trimDecimals(x, d): toFixed(d), then strip trailing zeros/dot. */
  fmt.trimDecimals = function (x, d) {
    var s = x.toFixed(d);
    if (s.indexOf('.') >= 0) {
      s = s.replace(/0+$/, '');
      s = s.replace(/\.$/, '');
    }
    return s;
  };

  /** 3.2 sig3(x): 3 significant digits as a plain string. */
  fmt.sig3 = function (x) {
    return String(Number(x.toPrecision(3)));
  };

  /** 3.3 duration(seconds) — human duration, two most significant units. */
  fmt.duration = function (s) {
    if (!isFinite(s)) return '∞';
    s = Math.max(0, s);
    if (s === 0) return '0 s';
    if (s < 1e-6) return (s * 1e9).toFixed(1) + ' ns';
    if (s < 1e-3) return (s * 1e6).toFixed(1) + ' µs';
    if (s < 1) return fmt.sig3(s * 1e3) + ' ms';
    if (s < 10) return s.toFixed(2) + ' s';
    if (s < 60) return s.toFixed(1) + ' s';

    if (s < 3600) {
      var m = Math.floor(s / 60);
      var sec = Math.round(s - 60 * m);
      if (sec === 60) {
        m += 1;
        sec = 0;
      }
      if (m === 60) return '1 h';
      return m + ' min' + (sec ? ' ' + sec + ' s' : '');
    }

    if (s < 86400) {
      var h = Math.floor(s / 3600);
      var mi = Math.round((s - 3600 * h) / 60);
      if (mi === 60) {
        h += 1;
        mi = 0;
      }
      if (h === 24) return '1 d';
      return h + ' h' + (mi ? ' ' + mi + ' min' : '');
    }

    if (s < 31557600) {
      var d = Math.floor(s / 86400);
      var hh = Math.round((s - 86400 * d) / 3600);
      if (hh === 24) {
        d += 1;
        hh = 0;
      }
      return d + ' d' + (hh ? ' ' + hh + ' h' : '');
    }

    var y = s / 31557600;
    if (y < 1000) {
      var yi = Math.floor(y);
      var mo = Math.round((y - yi) * 12);
      if (mo === 12) {
        yi += 1;
        mo = 0;
      }
      return yi + ' y' + (mo ? ' ' + mo + ' mo' : '');
    }
    if (y < 1e6) return Math.round(y).toLocaleString('en-US') + ' y';
    if (y < 1e9) return fmt.trimDecimals(y / 1e6, 2) + ' million y';
    return fmt.trimDecimals(y / 1e9, 2) + ' billion y';
  };

  /** 3.4 distanceKm(km) */
  fmt.distanceKm = function (km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    if (km < 1e6) return Math.round(km).toLocaleString('en-US') + ' km';
    if (km < 1e9) return fmt.trimDecimals(km / 1e6, 1) + ' million km';
    if (km < 1e12) return fmt.trimDecimals(km / 1e9, 1) + ' billion km';
    return fmt.trimDecimals(km / 1e12, 2) + ' trillion km';
  };

  /** 3.5 compact(x) */
  fmt.compact = function (x) {
    if (x < 100) return fmt.trimDecimals(x, 1);
    if (x < 1e6) return Math.round(x).toLocaleString('en-US');
    if (x < 1e9) return fmt.trimDecimals(x / 1e6, 1) + ' million';
    return fmt.trimDecimals(x / 1e9, 1) + ' billion';
  };

  /** 3.6 bitrate(bps) */
  fmt.bitrate = function (bps) {
    var unit = 'bps';
    var size = 1;
    if (bps < 1e3) {
      unit = 'bps';
      size = 1;
    } else if (bps < 1e6) {
      unit = 'kbps';
      size = 1e3;
    } else if (bps < 1e9) {
      unit = 'Mbps';
      size = 1e6;
    } else if (bps < 1e12) {
      unit = 'Gbps';
      size = 1e9;
    } else {
      unit = 'Tbps';
      size = 1e12;
    }
    return fmt.sig3(bps / size) + ' ' + unit;
  };

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** 3.7 elapsed(seconds) — "T+" label */
  fmt.elapsed = function (seconds) {
    if (seconds < 86400) {
      var t = Math.max(0, Math.floor(seconds));
      return 'T+' + pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor((t % 3600) / 60)) + ':' + pad2(t % 60);
    }
    return 'T+' + fmt.duration(seconds);
  };

  /** 3.8 clock(baseMs, seconds) — simulated wall-clock label */
  fmt.clock = function (baseMs, seconds) {
    var d = new Date(baseMs + seconds * 1000);
    if (seconds < 86400) return d.toLocaleTimeString('en-GB');
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  /** 3.9 multiplierReadout(mult) */
  fmt.multiplierReadout = function (mult) {
    if (mult === 1) {
      return 'Real time — 1 second of your time = 1 second of simulated time';
    }
    return '1 second of your time = ' + fmt.duration(mult) + ' of simulated time';
  };

  /** 3.10 speedBadge(mult, paused) */
  fmt.speedBadge = function (mult, paused) {
    if (paused) return 'PAUSED';
    if (mult === 1) return 'REAL TIME';
    return 'FAST-FORWARD ×' + mult.toLocaleString('en-US');
  };

  /** 3.11 percentOfC(epsilon) */
  fmt.percentOfC = function (epsilon) {
    var decimals = Math.max(1, Math.ceil(-Math.log10(epsilon)) - 2);
    return (100 - 100 * epsilon).toFixed(decimals) + '%';
  };

  /** Traveller speed text (Section 5.1 display rules). */
  fmt.travellerSpeed = function (kmS) {
    if (kmS < 1) return Math.round(kmS * 3600).toLocaleString('en-US') + ' km/h';
    if (kmS >= 1000) return Math.round(kmS).toLocaleString('en-US') + ' km/s';
    return Math.round(kmS).toLocaleString('en-US') + ' km/s';
  };

  /** "100%" for light, otherwise sig3 percent of c. */
  fmt.percentOfLight = function (kmS) {
    if (kmS >= IPI.CONST.C_KM_S) return '100%';
    return fmt.sig3((kmS / IPI.CONST.C_KM_S) * 100) + '%';
  };

  /** Scientific notation with superscript exponent: "1.16 × 10^17". */
  fmt.scientific = function (x) {
    if (x === 0) return '0';
    var exp = Math.floor(Math.log10(Math.abs(x)));
    var mant = x / Math.pow(10, exp);
    var mantStr = fmt.sig3(mant);
    return { mantissa: mantStr, exponent: exp, text: mantStr + ' × 10^' + exp };
  };

  /* ------------------------------------------------------------------ *
   * Shared ticker (Section 2.2) — one rAF loop for the whole page
   * ------------------------------------------------------------------ */

  IPI.ticker = {
    subs: [],
    running: false,
    last: 0,
    add: function (fn) {
      this.subs.push(fn);
    },
    start: function () {
      if (this.running) return;
      this.running = true;
      var self = this;
      function loop(ts) {
        if (!self.last) self.last = ts;
        var dt = Math.min((ts - self.last) / 1000, 0.1); // cap: background tabs pause
        self.last = ts;
        for (var i = 0; i < self.subs.length; i++) self.subs[i](dt, ts);
        window.requestAnimationFrame(loop);
      }
      window.requestAnimationFrame(loop);
    }
  };

  /* ------------------------------------------------------------------ *
   * Shared UI components (Section 2.4)
   * ------------------------------------------------------------------ */

  var ui = (IPI.ui = {});

  var uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return prefix + '-' + uidCounter;
  }

  /**
   * createTabs(container, items, onChange, initialId)
   * ARIA tab list with roving tabindex; Left/Right move selection and focus,
   * Home/End jump to first/last. Does not fire onChange during construction.
   */
  ui.createTabs = function (container, items, onChange, initialId) {
    container.classList.add('tabs');
    container.setAttribute('role', 'tablist');
    var buttons = [];
    var currentId = initialId;

    function select(id, focus) {
      var index = -1;
      for (var k = 0; k < items.length; k++) if (items[k].id === id) index = k;
      if (index < 0) return;
      if (id !== currentId) {
        currentId = id;
        for (var i = 0; i < items.length; i++) {
          var active = items[i].id === id;
          buttons[i].setAttribute('aria-selected', active ? 'true' : 'false');
          buttons[i].tabIndex = active ? 0 : -1;
        }
        onChange(id);
      }
      if (focus) buttons[index].focus();
    }

    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      var name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = item.label;
      b.appendChild(name);
      if (item.sub) {
        var sub = document.createElement('span');
        sub.className = 'tab-sub mono';
        sub.textContent = item.sub;
        b.appendChild(sub);
      }
      var active = item.id === currentId;
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.tabIndex = active ? 0 : -1;
      b.addEventListener('click', function () {
        select(item.id, false);
      });
      b.addEventListener('keydown', function (e) {
        var idx = items.indexOf(item);
        var next = -1;
        if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        if (next >= 0) {
          e.preventDefault();
          select(items[next].id, true);
        }
      });
      buttons.push(b);
      container.appendChild(b);
    });

    return {
      set: function (id) {
        currentId = null; // force re-select
        select(id, false);
      },
      get: function () {
        return currentId;
      }
    };
  };

  /**
   * createSpeedChips(container, onChange, initialMult, recommendedMult)
   * Horizontally scrollable row of 11 chips with aria-pressed.
   */
  ui.createSpeedChips = function (container, onChange, initialMult, recommendedMult) {
    container.classList.add('speed-chips');
    var active = initialMult;
    var recommended = recommendedMult;
    var chips = [];

    function render() {
      for (var i = 0; i < chips.length; i++) {
        var m = IPI.SPEEDS[i];
        var chip = chips[i];
        var isRec = m === recommended;
        var isActive = m === active;
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        chip.classList.toggle('is-active', isActive);
        util.setText(chip.querySelector('.chip-label'), IPI.SPEED_LABELS[i]);
        var star = chip.querySelector('.chip-star');
        if (isRec && !star) {
          star = document.createElement('span');
          star.className = 'chip-star';
          star.setAttribute('aria-hidden', 'true');
          star.textContent = '★';
          chip.appendChild(star);
        } else if (!isRec && star) {
          chip.removeChild(star);
        }
        util.setAttr(
          chip,
          'title',
          isRec ? 'Recommended speed for this destination' : IPI.SPEED_TITLES[i]
        );
        util.setAttr(chip, 'aria-label', IPI.SPEED_TITLES[i]);
      }
    }

    IPI.SPEEDS.forEach(function (mult, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      var label = document.createElement('span');
      label.className = 'chip-label';
      label.textContent = IPI.SPEED_LABELS[i];
      b.appendChild(label);
      b.addEventListener('click', function () {
        active = mult;
        render();
        onChange(mult);
      });
      chips.push(b);
      container.appendChild(b);
    });

    render();

    return {
      set: function (mult) {
        active = mult;
        render();
      },
      setRecommended: function (mult) {
        recommended = mult;
        render();
      },
      get: function () {
        return active;
      }
    };
  };

  /**
   * createSegmented(container, items, onChange, initialId)
   * Pill-style segmented control with radio-group semantics.
   */
  ui.createSegmented = function (container, items, onChange, initialId) {
    container.classList.add('segmented');
    container.setAttribute('role', 'radiogroup');
    var buttons = [];
    var currentId = initialId;

    function select(id, focus) {
      if (id !== currentId) {
        currentId = id;
        for (var i = 0; i < items.length; i++) {
          var active = items[i].id === id;
          buttons[i].setAttribute('aria-checked', active ? 'true' : 'false');
          buttons[i].classList.toggle('is-active', active);
          buttons[i].tabIndex = active ? 0 : -1;
        }
        onChange(id);
      }
      if (focus) {
        for (var j = 0; j < items.length; j++) {
          if (items[j].id === id) buttons[j].focus();
        }
      }
    }

    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.setAttribute('role', 'radio');
      b.textContent = item.label;
      var active = item.id === currentId;
      b.setAttribute('aria-checked', active ? 'true' : 'false');
      b.classList.toggle('is-active', active);
      b.tabIndex = active ? 0 : -1;
      b.addEventListener('click', function () {
        select(item.id, false);
      });
      b.addEventListener('keydown', function (e) {
        var idx = items.indexOf(item);
        var next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        if (next >= 0) {
          e.preventDefault();
          select(items[next].id, true);
        }
      });
      buttons.push(b);
      container.appendChild(b);
    });

    return {
      set: function (id) {
        if (id == null) {
          currentId = null;
          for (var n = 0; n < items.length; n++) {
            buttons[n].setAttribute('aria-checked', 'false');
            buttons[n].classList.remove('is-active');
            buttons[n].tabIndex = -1;
          }
          return;
        }
        var prev = currentId;
        currentId = null;
        // re-run select without firing onChange if unchanged
        if (id === prev) {
          currentId = id;
          for (var i = 0; i < items.length; i++) {
            var active = items[i].id === id;
            buttons[i].setAttribute('aria-checked', active ? 'true' : 'false');
            buttons[i].classList.toggle('is-active', active);
            buttons[i].tabIndex = active ? 0 : -1;
          }
          return;
        }
        select(id, false);
      },
      get: function () {
        return currentId;
      }
    };
  };
})();
