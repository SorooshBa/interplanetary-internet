/*
 * dtn.js — Section 8.7: how it really works.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;
  var CONST = IPI.CONST;

  var PL_DEST = {
    moon: { km: 384400 },
    mars: { km: 225000000 },
    proxima: { km: 4.2465 * 9460730472580.8 }
  };

  /* ================================================================== *
   * 8.7.A Page-load timeline
   * ================================================================== */

  var pl = {
    dest: 'mars',
    playing: false,
    progress: 0, // 0..1 over 4R
    durationReal: 6,
    autoPlayed: false,
    visible: false
  };
  var plEls = {};
  var plSeg = null;

  function plR() {
    return 2 * PL_DEST[pl.dest].km / CONST.C_KM_S;
  }

  function setPlDest(id) {
    pl.dest = id;
    pl.playing = false;
    pl.progress = 0;
    util.setText(plEls.play, 'Play');
    plEls.playhead.hidden = true;
    updatePlLabels();
    updatePlFills();
  }

  function updatePlLabels() {
    var R = plR();
    util.setText(plEls.end1, 'Page arrives after ' + fmt.duration(4 * R));
    util.setText(plEls.end2, 'Page arrives after ' + fmt.duration(R));
    util.setText(plEls.end3, '0 s');

    // ruler: 5 ticks
    plEls.ruler.textContent = '';
    for (var k = 0; k <= 4; k++) {
      var span = document.createElement('span');
      span.textContent = fmt.duration(k * R);
      span.style.left = ((k / 4) * 100).toFixed(2) + '%';
      plEls.ruler.appendChild(span);
    }
  }

  function updatePlFills() {
    var f = pl.progress;
    // Row 1: four segments, each spans [k/4, (k+1)/4]
    for (var k = 0; k < plEls.segs1.length; k++) {
      var fill = util.clamp((f - k / 4) * 4, 0, 1);
      plEls.segs1[k].style.width = (fill * 100).toFixed(1) + '%';
    }
    // Row 2: one segment spanning [0, 1/4]
    var fill2 = util.clamp(f * 4, 0, 1);
    plEls.seg2.style.width = (fill2 * 100).toFixed(1) + '%';

    // playhead
    if (pl.playing || f > 0) {
      plEls.playhead.hidden = false;
      plEls.playhead.style.left = (f * 100).toFixed(2) + '%';
    }
  }

  function startPlPlay() {
    if (pl.progress >= 1) pl.progress = 0;
    pl.playing = true;
    util.setText(plEls.play, 'Playing…');
    plEls.playhead.hidden = false;
  }

  function skipPl() {
    pl.playing = false;
    pl.progress = 1;
    util.setText(plEls.play, 'Play');
    updatePlFills();
  }

  function updatePl(dtReal) {
    if (pl.playing) {
      pl.progress = util.clamp(pl.progress + dtReal / pl.durationReal, 0, 1);
      updatePlFills();
      if (pl.progress >= 1) {
        pl.playing = false;
        util.setText(plEls.play, 'Play');
      }
    }
  }

  /* ================================================================== *
   * 8.7.B Store-and-forward demo
   * ================================================================== */

  var LINK_TIMES = [0.8, 3.0, 1.0];
  var DEPART_SPACING = 0.3;
  var CONJUNCTION_SECONDS = 8;

  var sfd = {
    mode: 'dtn', // 'dtn' | 'classic'
    linksUp: [true, true, true],
    bundles: [], // { id, node, state, link, t0, dur, el, nextRetry }
    nextId: 1,
    sent: 0,
    delivered: 0,
    lost: 0,
    now: 0,
    lastDepart: [-1, -1, -1, -1],
    toastUntil: 0,
    conjunctionUntil: -1,
    conjunctionRestoring: false
  };
  var sfdEls = {};
  var sfdSeg = null;

  function setLinkUp(i, up) {
    sfd.linksUp[i] = up;
    var linkEl = sfdEls.linkEls[i];
    linkEl.classList.toggle('is-down', !up);
    util.setText(sfdEls.toggleLabels[i], 'Link ' + (i + 1) + ': ' + (up ? 'Up' : 'Down'));
    sfdEls.toggles[i].checked = up;
    if (i === 1 && !up) {
      sfdEls.sun.hidden = false;
    } else if (i === 1 && up) {
      sfdEls.sun.hidden = true;
    }
    // Classic mode: bundles currently traveling on this link are lost
    if (!up && sfd.mode === 'classic') {
      sfd.bundles.slice().forEach(function (b) {
        if (b.state === 'travel' && b.link === i) loseBundle(b);
      });
    }
    updateStorageBadges();
  }

  function showToast() {
    sfd.toastUntil = sfd.now + 3;
    sfdEls.toast.hidden = false;
  }

  function updateToast() {
    if (!sfdEls.toast.hidden && sfd.now >= sfd.toastUntil) {
      sfdEls.toast.hidden = true;
    }
  }

  function updateCounters() {
    var stored = 0;
    sfd.bundles.forEach(function (b) {
      if (b.state === 'stored') stored++;
    });
    util.setText(
      sfdEls.counters,
      'Sent ' + sfd.sent + ' · Stored ' + stored + ' · Delivered ' + sfd.delivered + ' · Lost ' + sfd.lost
    );
  }

  function updateStorageBadges() {
    var counts = [0, 0, 0, 0];
    sfd.bundles.forEach(function (b) {
      if (b.state === 'stored') counts[b.node]++;
    });
    for (var n = 0; n < 4; n++) {
      var box = sfdEls.storage[n];
      var count = counts[n];
      box.hidden = count === 0;
      util.setText(sfdEls.storageCounts[n], count + ' stored');
      var badges = sfdEls.storageBadges[n];
      while (badges.children.length < count) badges.appendChild(document.createElement('span')).className = 'sfd-badge';
      while (badges.children.length > count) badges.removeChild(badges.lastChild);
    }
    updateCounters();
  }

  function positionBundle(b, centers) {
    if (!b.el) return;
    if (!centers) centers = nodeCenters();
    if (b.state === 'travel') {
      var a = centers[b.link];
      var c = centers[b.link + 1];
      var t = util.clamp((sfd.now - b.t0) / b.dur, 0, 1);
      b.el.style.left = (a.x + (c.x - a.x) * t) + 'px';
      b.el.style.top = (a.y + (c.y - a.y) * t) + 'px';
    } else {
      var p = centers[b.node];
      // slight offset so stacked stored bundles are distinguishable
      var idx = 0;
      for (var i = 0; i < sfd.bundles.length; i++) {
        if (sfd.bundles[i] === b) break;
        if (sfd.bundles[i].state === 'stored' && sfd.bundles[i].node === b.node) idx++;
      }
      b.el.style.left = p.x + 'px';
      b.el.style.top = (p.y + 18 + idx * 4) + 'px';
    }
  }

  function nodeCenters() {
    var flowRect = sfdEls.flow.getBoundingClientRect();
    var out = [];
    for (var i = 0; i < 4; i++) {
      var r = sfdEls.nodes[i].getBoundingClientRect();
      out.push({
        x: r.left - flowRect.left + r.width / 2,
        y: r.top - flowRect.top + r.height / 2
      });
    }
    return out;
  }

  function sendBundle() {
    var b = {
      id: sfd.nextId++,
      node: 0,
      state: 'stored',
      link: 0,
      t0: 0,
      dur: 0,
      el: null,
      nextRetry: 0
    };
    var el = document.createElement('div');
    el.className = 'sfd-bundle ' + (sfd.mode === 'dtn' ? 'mode-dtn' : 'mode-classic');
    b.el = el;
    sfdEls.bundles.appendChild(el);
    sfd.bundles.push(b);
    sfd.sent++;
    sfdEls.log.textContent = 'Bundle ' + b.id + ' is stored at Mission Control \u2014 waiting for Link 1.';
    positionBundle(b);
    updateStorageBadges();
    // try immediate departure
    tryDepart(b);
  }

  function tryDepart(b) {
    if (b.state !== 'stored') return;
    if (b.node >= 3) return; // already delivered
    if (sfd.now - sfd.lastDepart[b.node] < DEPART_SPACING) return;
    var link = b.node;
    if (sfd.mode === 'classic') {
      if (!sfd.linksUp[link]) {
        loseBundle(b);
        showToast();
        return;
      }
    } else {
      if (!sfd.linksUp[link]) return; // wait stored
    }
    // depart
    sfd.lastDepart[b.node] = sfd.now;
    b.state = 'travel';
    b.link = link;
    b.t0 = sfd.now;
    b.dur = LINK_TIMES[link];
    positionBundle(b);
  }

  function arriveAtNode(b) {
    b.node = b.link + 1;
    if (b.node >= 3) {
      // delivered to Rover
      b.state = 'done';
      sfd.delivered++;
      if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
      b.el = null;
      sfdEls.log.textContent = 'Bundle ' + b.id + ' delivered to the rover.';
      showRoverCheck();
      updateStorageBadges();
      return;
    }
    if (sfd.mode === 'classic') {
      // no storage in Classic mode: depart immediately or be lost
      b.state = 'stored';
      b.nextRetry = sfd.now;
      tryDepart(b);
      updateStorageBadges();
      return;
    }
    b.state = 'stored';
    b.nextRetry = sfd.now;
    sfdEls.log.textContent = 'Bundle ' + b.id + ' is stored at ' + NODE_NAMES[b.node] +
      ' \u2014 waiting for Link ' + (b.node + 1) + '.';
    positionBundle(b);
    updateStorageBadges();
  }

  var NODE_NAMES = ['Mission Control', 'DSN antenna', 'Mars orbiter', 'Rover'];

  function loseBundle(b) {
    b.state = 'lost';
    sfd.lost++;
    if (b.el) {
      b.el.classList.add('is-lost');
      b.el.textContent = '\u2715';
      var el = b.el;
      b.el = null;
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 600);
    }
    sfdEls.log.textContent = 'Bundle ' + b.id + ' lost \u2014 no end-to-end path.';
    updateStorageBadges();
  }

  function showRoverCheck() {
    var rover = sfdEls.nodes[3];
    rover.classList.add('is-done');
    var check = rover.querySelector('.sfd-check');
    if (!check) {
      check = document.createElement('span');
      check.className = 'sfd-check';
      check.textContent = '\u2713';
      rover.appendChild(check);
    }
    // clear the check after a moment so repeated deliveries re-show it
    window.setTimeout(function () {
      rover.classList.remove('is-done');
      if (check.parentNode) check.parentNode.removeChild(check);
    }, 1500);
  }

  function resetSfd() {
    sfd.bundles.forEach(function (b) {
      if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
    });
    sfd.bundles = [];
    sfd.nextId = 1;
    sfd.sent = 0;
    sfd.delivered = 0;
    sfd.lost = 0;
    sfd.lastDepart = [-1, -1, -1, -1];
    sfd.toastUntil = 0;
    sfd.conjunctionUntil = -1;
    sfdEls.toast.hidden = true;
    sfdEls.log.textContent = '';
    setLinkUp(0, true);
    setLinkUp(1, true);
    setLinkUp(2, true);
    updateStorageBadges();
  }

  function solarConjunction() {
    if (sfd.conjunctionUntil > sfd.now) return; // already running
    setLinkUp(1, false);
    sfd.conjunctionUntil = sfd.now + CONJUNCTION_SECONDS;
    sfdEls.log.textContent = 'Solar conjunction \u2014 Link 2 blocked by the Sun for 8 seconds.';
  }

  function updateConjunction() {
    if (sfd.conjunctionUntil > 0 && sfd.now >= sfd.conjunctionUntil) {
      sfd.conjunctionUntil = -1;
      setLinkUp(1, true);
      sfdEls.log.textContent = 'Conjunction over \u2014 Link 2 is back up.';
    }
  }

  function updateSfd(dtReal) {
    sfd.now += dtReal;
    updateConjunction();
    updateToast();

    // travel progress (batch layout reads: one centers pass per frame)
    var centers = null;
    sfd.bundles.slice().forEach(function (b) {
      if (b.state === 'travel') {
        if (sfd.now - b.t0 >= b.dur) {
          arriveAtNode(b);
        } else {
          if (!centers) centers = nodeCenters();
          positionBundle(b, centers);
        }
      }
    });

    // retries: FIFO order among stored bundles
    var stored = sfd.bundles.filter(function (b) {
      return b.state === 'stored';
    });
    // group by node, preserve send order (FIFO)
    var byNode = [[], [], [], []];
    stored.forEach(function (b) {
      byNode[b.node].push(b);
    });
    byNode.forEach(function (queue) {
      if (!queue.length) return;
      var head = queue[0];
      tryDepart(head);
    });
  }

  /* ================================================================== *
   * 8.7.C DSN widget
   * ================================================================== */

  var DSN_STATIONS = [
    { name: 'Goldstone', lon: -117 },
    { name: 'Madrid', lon: -4 },
    { name: 'Canberra', lon: 149 }
  ];
  var COS_LIMIT = Math.cos(84 * Math.PI / 180);

  var dsn = {
    rotation: 0,
    paused: false,
    reduced: false
  };
  var dsnEls = {};
  var dsnCanvas = null;
  var dsnVisible = false;

  function drawDsn() {
    if (!dsnCanvas) return;
    var ctx = dsnCanvas.ctx;
    var W = dsnCanvas.w;
    var H = dsnCanvas.h;
    ctx.clearRect(0, 0, W, H);
    var cx = W / 2;
    var cy = H / 2;
    var r = 70;

    // Earth disk (gradient, no land)
    var grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#3FA0FF');
    grad.addColorStop(0.6, '#1458B8');
    grad.addColorStop(1, '#072A63');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // spacecraft diamond on the right
    var sx = cx + 110;
    var sy = cy;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 5);
    ctx.lineTo(sx + 5, sy);
    ctx.lineTo(sx, sy + 5);
    ctx.lineTo(sx - 5, sy);
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#A9B4C8';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Spacecraft (far away, to the right)', cx + 60, cy - 14);

    // stations
    var best = null;
    var bestCos = -2;
    DSN_STATIONS.forEach(function (st) {
      var angle = (st.lon * Math.PI / 180) + dsn.rotation;
      var cosA = Math.cos(angle);
      var visible = cosA > COS_LIMIT;
      var x = cx + Math.cos(angle) * r;
      var y = cy - Math.sin(angle) * r;

      if (visible) {
        // beam to spacecraft
        ctx.strokeStyle = 'rgba(74,222,128,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        if (cosA > bestCos) {
          bestCos = cosA;
          best = st;
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = visible ? '#4ADE80' : '#5CE1E6';
      ctx.globalAlpha = visible ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = visible ? '#4ADE80' : '#6E7A92';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      var lx = cx + Math.cos(angle) * (r + 16);
      var ly = cy - Math.sin(angle) * (r + 16);
      ctx.fillText(st.name, lx, ly + (Math.sin(angle) > 0 ? 12 : -4));
    });

    util.setText(dsnEls.status, 'Talking to: ' + (best ? best.name : '\u2014'));
  }

  function updateDsn(dtReal) {
    if (!dsn.paused && !dsn.reduced) {
      dsn.rotation += dtReal * 2 * Math.PI / 24; // one turn per 24 real seconds
    }
    if (dsnCanvas && dsnCanvas.isVisible && !document.hidden) drawDsn();
  }

  /* ================================================================== *
   * Init
   * ================================================================== */

  IPI.dtn = {
    init: function () {
      /* --- A: page-load timeline --- */
      plEls.dest = document.getElementById('pl-dest');
      plEls.play = document.getElementById('pl-play');
      plEls.skip = document.getElementById('pl-skip');
      plEls.end1 = document.getElementById('pl-end-1');
      plEls.end2 = document.getElementById('pl-end-2');
      plEls.end3 = document.getElementById('pl-end-3');
      plEls.ruler = document.getElementById('pl-ruler');
      plEls.playhead = document.getElementById('pl-playhead');
      plEls.segs1 = document.querySelectorAll('#pl-rows [data-seg]');
      plEls.seg2 = document.querySelector('#pl-rows [data-seg2] .pl-fill');

      plSeg = IPI.ui.createSegmented(
        plEls.dest,
        [
          { id: 'moon', label: 'Moon' },
          { id: 'mars', label: 'Mars (average)' },
          { id: 'proxima', label: 'Proxima Centauri' }
        ],
        setPlDest,
        pl.dest
      );

      plEls.play.addEventListener('click', startPlPlay);
      plEls.skip.addEventListener('click', skipPl);

      // make row segments proportional (width of full track = 4R)
      for (var i = 0; i < plEls.segs1.length; i++) {
        plEls.segs1[i].style.flex = 'none';
        plEls.segs1[i].style.width = '25%';
      }
      var seg2wrap = document.querySelector('#pl-rows [data-seg2]');
      seg2wrap.style.flex = 'none';
      seg2wrap.style.width = '25%';

      updatePlLabels();
      updatePlFills();

      var plReduced = util.reducedMotion();
      util.observeVisible(document.getElementById('dtn'), function (v) {
        pl.visible = v;
        if (v && !pl.autoPlayed) {
          pl.autoPlayed = true;
          if (plReduced) {
            pl.progress = 1;
            updatePlFills();
          } else {
            startPlPlay();
          }
        }
      });

      /* --- B: store-and-forward --- */
      sfdEls.flow = document.getElementById('sfd-flow');
      sfdEls.bundles = document.getElementById('sfd-bundles');
      sfdEls.mode = document.getElementById('sfd-mode');
      sfdEls.send = document.getElementById('sfd-send');
      sfdEls.conjunction = document.getElementById('sfd-conjunction');
      sfdEls.reset = document.getElementById('sfd-reset');
      sfdEls.counters = document.getElementById('sfd-counters');
      sfdEls.log = document.getElementById('sfd-log');
      sfdEls.toast = document.getElementById('sfd-toast');
      sfdEls.sun = document.getElementById('sfd-sun');
      sfdEls.nodes = [];
      sfdEls.storage = [];
      sfdEls.storageCounts = [];
      sfdEls.storageBadges = [];
      sfdEls.linkEls = [];
      sfdEls.toggles = [];
      sfdEls.toggleLabels = [];

      for (var n = 0; n < 4; n++) {
        var node = document.getElementById('sfd-node-' + n);
        sfdEls.nodes.push(node);
        sfdEls.storage.push(node.querySelector('.sfd-storage'));
        sfdEls.storageCounts.push(node.querySelector('.sfd-storage-count'));
        sfdEls.storageBadges.push(node.querySelector('.sfd-badges'));
      }
      for (var l = 0; l < 3; l++) {
        sfdEls.linkEls.push(sfdEls.flow.querySelector('[data-link="' + l + '"]'));
        sfdEls.toggles.push(sfdEls.flow.querySelector('[data-toggle="' + l + '"]'));
        sfdEls.toggleLabels.push(sfdEls.toggles[l].parentNode.querySelector('.sfd-toggle-label'));
      }

      sfdSeg = IPI.ui.createSegmented(
        sfdEls.mode,
        [
          { id: 'dtn', label: 'DTN (store-and-forward)' },
          { id: 'classic', label: 'Classic (needs live path)' }
        ],
        function (id) {
          sfd.mode = id;
        },
        'dtn'
      );

      sfdEls.toggles.forEach(function (input, idx) {
        input.addEventListener('change', function () {
          setLinkUp(idx, input.checked);
        });
      });
      sfdEls.send.addEventListener('click', sendBundle);
      sfdEls.conjunction.addEventListener('click', solarConjunction);
      sfdEls.reset.addEventListener('click', resetSfd);

      updateStorageBadges();

      util.observeVisible(sfdEls.flow, function () {
        // re-position stored bundles after layout settles
        var centers = nodeCenters();
        sfd.bundles.forEach(function (b) {
          positionBundle(b, centers);
        });
      });

      /* --- C: DSN widget --- */
      dsnEls.canvas = document.getElementById('dsn-canvas');
      dsnEls.status = document.getElementById('dsn-status');
      dsnEls.pause = document.getElementById('dsn-pause');
      dsnEls.reduced = document.getElementById('dsn-reduced');

      dsn.reduced = util.reducedMotion();
      dsnCanvas = util.canvas(dsnEls.canvas);

      dsnEls.pause.addEventListener('click', function () {
        dsn.paused = !dsn.paused;
        util.setText(dsnEls.pause, dsn.paused ? 'Play' : 'Pause');
      });

      if (dsn.reduced) {
        util.setText(dsnEls.pause, 'Play');
        dsnEls.reduced.hidden = false;
        drawDsn();
      }

      util.observeVisible(dsnEls.canvas, function (v) {
        dsnVisible = v;
      });

      /* --- shared ticker --- */
      IPI.ticker.add(function (dtReal) {
        if (document.hidden) return;
        updatePl(dtReal);
        updateSfd(dtReal);
        if (dsnVisible || dsn.reduced) updateDsn(dtReal);
      });
    }
  };
})();
