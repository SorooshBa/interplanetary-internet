/*
 * simulator.js — Section 8.3: the packet simulator.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;
  var CONST = IPI.CONST;

  var MAX_PACKETS = 12;

  var sim = {
    dest: 'mars',
    marsT: IPI.MARS_T_AVG,
    mult: 100,
    paused: false,
    simT: 0,
    packets: [],
    recent: [],
    nextId: 1,
    pingSeq: 0,
    terminalLines: [],
    effects: [],
    pingHeaderShown: false
  };

  var RECOMMENDED = { moon: 1, mars: 100, proxima: 10000000 };

  var els = {};
  var speedChips = null;
  var tabs = null;
  var presets = null;
  var scene = null;
  var orbit = null;
  var visible = false;
  var realT = 0;
  var lastPacketsRender = 0;
  var bodyFont = 'ui-sans-serif, system-ui, sans-serif';

  /* ------------------------------ Distances ------------------------------ */

  function distKm() {
    if (sim.dest === 'moon') return 384400;
    if (sim.dest === 'mars') return 54600000 + sim.marsT * 346400000;
    return 4.2465 * 9460730472580.8;
  }

  function owd() {
    return distKm() / CONST.C_KM_S;
  }

  /* -------------------------------- Reset -------------------------------- */

  function resetConversation() {
    sim.simT = 0;
    sim.packets = [];
    sim.recent = [];
    sim.nextId = 1;
    sim.pingSeq = 0;
    sim.terminalLines = [];
    sim.effects = [];
    sim.pingHeaderShown = false;
    renderTerminal();
    renderRecent();
    renderPackets(true);
    updateReadouts(true);
  }

  function setDestination(destId) {
    sim.dest = destId;
    resetConversation();
    speedChips.setRecommended(RECOMMENDED[destId]);
    speedChips.set(RECOMMENDED[destId]);
    sim.mult = RECOMMENDED[destId];

    var isMars = destId === 'mars';
    els.marsPanel.hidden = !isMars;

    var dest = IPI.DEST[destId];
    els.canvas.setAttribute('aria-label', 'Diagram: a packet travels from Earth to ' + dest.name + '.');

    renderTravellers();
    renderFacts();
    util.setText(els.aboutTitle, 'About ' + dest.name);
    util.setText(els.convText, IPI.CONVERSATION_TEXT[destId]);
    updateReadouts(true);
    updateSpeedUI();
  }

  /* ------------------------------- Terminal ------------------------------- */

  function printLine(text, cls) {
    sim.terminalLines.push({ text: text, cls: cls || 'terminal-line' });
    if (sim.terminalLines.length > 200) sim.terminalLines.shift();
    renderTerminal();
  }

  function renderTerminal() {
    var frag = document.createDocumentFragment();
    sim.terminalLines.forEach(function (line) {
      var div = document.createElement('div');
      div.className = line.cls;
      div.textContent = line.text;
      frag.appendChild(div);
    });
    els.terminal.textContent = '';
    els.terminal.appendChild(frag);
    els.terminal.scrollTop = els.terminal.scrollHeight;
  }

  function pingTimeString(rtt) {
    if (rtt < 10) return (rtt * 1000).toFixed(1) + ' ms';
    if (rtt < 1e6) {
      return rtt.toFixed(1) + ' s' + (rtt >= 60 ? ' (' + fmt.duration(rtt) + ')' : '');
    }
    return Math.round(rtt).toLocaleString('en-US') + ' s (' + fmt.duration(rtt) + ')';
  }

  /* -------------------------------- Packets ------------------------------- */

  function fullFlight() {
    return sim.packets.length >= MAX_PACKETS;
  }

  function send(kind) {
    if (fullFlight()) return;
    var o = owd();
    var p = {
      id: sim.nextId++,
      kind: kind,
      sentAt: sim.simT,
      owd: o,
      timedOut: false,
      bounced: false
    };
    if (kind === 'ping') {
      p.seq = ++sim.pingSeq;
      if (!sim.pingHeaderShown) {
        sim.pingHeaderShown = true;
        var dest = IPI.DEST[sim.dest];
        printLine('PING ' + dest.host + ' — Earth to ' + dest.name + ', 64 bytes of data', 'terminal-header');
      }
    }
    sim.packets.push(p);
    updateButtons();
    updateReadouts(true);
  }

  function arrive(p) {
    sim.recent.push({ id: p.id, kind: p.kind, took: p.owd * (p.kind === 'ping' ? 2 : 1) });
    if (sim.recent.length > 5) sim.recent.shift();
    renderRecent();

    var dest = IPI.DEST[sim.dest];
    if (p.kind === 'packet') {
      spawnEffect('dest', 0.6, '#5CE1E6', 4, 28);
      util.setText(els.live, 'Packet ' + p.id + ' arrived after ' + fmt.duration(p.owd) + '.');
    } else {
      spawnEffect('earth', 0.6, '#4ADE80', 4, 28);
      var rtt = p.owd * 2;
      if (p.timedOut) {
        printLine(
          'Late reply from ' + dest.host + ': icmp_seq=' + p.seq + ' time=' + pingTimeString(rtt) +
          ' (a real ping tool gave up long ago)',
          'terminal-dim'
        );
      } else {
        printLine(
          '64 bytes from ' + dest.host + ': icmp_seq=' + p.seq + ' ttl=64 time=' + pingTimeString(rtt),
          'terminal-line'
        );
      }
      util.setText(els.live, 'Ping ' + p.id + ' returned after ' + fmt.duration(rtt) + '.');
    }
  }

  function spawnEffect(which, dur, color, r0, r1) {
    if (util.reducedMotion()) return;
    sim.effects.push({ which: which, age: 0, dur: dur, color: color, r0: r0, r1: r1 });
  }

  /* -------------------------------- Update -------------------------------- */

  function update(dtReal) {
    realT += dtReal;
    if (!sim.paused) sim.simT += dtReal * sim.mult;

    // process packets
    var arrived = [];
    for (var i = sim.packets.length - 1; i >= 0; i--) {
      var p = sim.packets[i];
      var total = p.kind === 'ping' ? 2 * p.owd : p.owd;
      var elapsedSim = sim.simT - p.sentAt;
      if (p.kind === 'ping') {
        var q = util.clamp(elapsedSim / (2 * p.owd), 0, 1);
        if (!p.bounced && q >= 0.5) {
          p.bounced = true;
          spawnEffect('dest', 0.4, '#FFB84D', 4, 22);
        }
        if (!p.timedOut && elapsedSim >= CONST.PING_TIMEOUT_S) {
          p.timedOut = true;
          printLine('Request timeout for icmp_seq=' + p.seq, 'terminal-warning');
        }
      }
      if (elapsedSim >= total) {
        arrived.push(p);
        sim.packets.splice(i, 1);
      }
    }
    arrived.forEach(arrive);
    if (arrived.length) updateButtons();

    // effects age in real seconds
    for (var e = sim.effects.length - 1; e >= 0; e--) {
      sim.effects[e].age += dtReal;
      if (sim.effects[e].age >= sim.effects[e].dur) sim.effects.splice(e, 1);
    }

    if (visible && !document.hidden) {
      drawScene();
      drawOrbit();
      updateReadouts(false);
      if (realT - lastPacketsRender >= 0.1) {
        lastPacketsRender = realT;
        renderPackets(false);
      }
    }
  }

  /* ------------------------------- Readouts ------------------------------- */

  function setText(id, text) {
    util.setText(els[id], text);
  }

  function updateReadouts(force) {
    var d = distKm();
    var o = owd();
    setText('readDistance', fmt.distanceKm(d));
    setText('readOwd', fmt.duration(o));
    setText('readRtt', fmt.duration(2 * o));
    setText('readElapsed', fmt.elapsed(sim.simT));
    setText('scaleDistance', fmt.distanceKm(d));
    setText('scaleLaps', fmt.compact(d / CONST.EARTH_EQUATOR_KM) + ' times');
    setText('scaleLight', fmt.duration(o));

    // latest packet
    var latest = null;
    sim.packets.forEach(function (p) {
      if (!latest || p.id > latest.id) latest = p;
    });
    var latestText;
    var latestSub = '';
    if (latest) {
      var total = latest.kind === 'ping' ? 2 * latest.owd : latest.owd;
      var elapsedSim = sim.simT - latest.sentAt;
      var prog = util.clamp(elapsedSim / total, 0, 1);
      var remaining = total - elapsedSim;
      var dir = 'outbound';
      if (latest.kind === 'ping' && prog >= 0.5) dir = 'returning';
      latestText = '#' + latest.id + ' · ' + dir + ' · ' + Math.round(prog * 100) + '% · ' +
        fmt.duration(remaining) + ' to go';
      latestSub = '≈ ' + fmt.duration(remaining / sim.mult) + ' of your time at ' +
        IPI.SPEED_LABELS[IPI.SPEEDS.indexOf(sim.mult)];
    } else if (sim.recent.length) {
      var last = sim.recent[sim.recent.length - 1];
      latestText = '#' + last.id + ' · arrived after ' + fmt.duration(last.took);
    } else {
      latestText = 'None yet — press Send packet.';
    }
    setText('readLatest', latestText);
    util.setText(els.readLatestSub, latestSub);
    els.readLatestSub.hidden = !latestSub;

    // slow warning
    var wait = o / sim.mult;
    if (wait > 120) {
      els.slowWarning.hidden = false;
      util.setText(els.slowWarning, 'At this speed one packet needs ' + fmt.duration(wait) +
        ' of your time to arrive. Try a faster speed — the ★ chip is a good start.');
    } else {
      els.slowWarning.hidden = true;
    }

    // mars slider text
    if (sim.dest === 'mars') {
      util.setText(els.marsDistText, fmt.distanceKm(d) + ' · one-way ' + fmt.duration(o));
    }

    // travellers times
    updateTravellerTimes(d);

    updateBadge();
  }

  function updateBadge() {
    var text = fmt.speedBadge(sim.mult, sim.paused);
    util.setText(els.badge, text);
    els.badge.className = 'badge ' + (sim.paused ? 'badge-paused' : sim.mult === 1 ? 'badge-real' : 'badge-fast');
  }

  function updateSpeedUI() {
    util.setText(els.speedReadout, fmt.multiplierReadout(sim.mult));
    updateBadge();
    updateReadouts(true);
  }

  function updateButtons() {
    var full = fullFlight();
    [els.sendBtn, els.pingBtn].forEach(function (b) {
      b.disabled = full;
      if (full) b.setAttribute('title', '12 packets are already in flight');
      else b.removeAttribute('title');
    });
  }

  /* ------------------------------ Renderings ------------------------------ */

  function renderRecent() {
    els.recent.textContent = '';
    if (!sim.recent.length) {
      var li = document.createElement('li');
      li.className = 'dim';
      li.textContent = 'Nothing has arrived yet.';
      els.recent.appendChild(li);
      return;
    }
    sim.recent.slice().reverse().forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = '#' + item.id + ' ' + (item.kind === 'ping' ? 'ping' : 'packet') + ' — ' +
        fmt.duration(item.took);
      els.recent.appendChild(li);
    });
  }

  function renderPackets(force) {
    var host = els.packetsList;
    host.textContent = '';
    if (!sim.packets.length) {
      var p = document.createElement('p');
      p.className = 'dim';
      p.textContent = 'No packets in flight.';
      host.appendChild(p);
      return;
    }
    var head = document.createElement('div');
    head.className = 'packet-head';
    ['#', 'Type', 'Direction', '', 'ETA'].forEach(function (label) {
      var span = document.createElement('span');
      span.textContent = label;
      head.appendChild(span);
    });
    host.appendChild(head);

    sim.packets.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (pk) {
      var total = pk.kind === 'ping' ? 2 * pk.owd : pk.owd;
      var elapsedSim = sim.simT - pk.sentAt;
      var prog = util.clamp(elapsedSim / total, 0, 1);
      var remaining = Math.max(0, total - elapsedSim);
      var dir = pk.kind === 'ping' && prog >= 0.5 ? '← returning' : '→ outbound';
      var color = pk.kind === 'packet' ? '#5CE1E6' : prog >= 0.5 ? '#4ADE80' : '#FFB84D';

      var row = document.createElement('div');
      row.className = 'packet-row';
      var c1 = document.createElement('span');
      c1.className = 'mono';
      c1.textContent = '#' + pk.id;
      var c2 = document.createElement('span');
      c2.textContent = pk.kind === 'ping' ? 'Ping' : 'Packet';
      var c3 = document.createElement('span');
      c3.className = 'dim';
      c3.textContent = dir;
      var c4 = document.createElement('div');
      c4.className = 'packet-bar';
      var fill = document.createElement('div');
      fill.className = 'packet-bar-fill';
      fill.style.width = (prog * 100).toFixed(1) + '%';
      fill.style.background = color;
      c4.appendChild(fill);
      var c5 = document.createElement('span');
      c5.className = 'mono';
      c5.textContent = fmt.duration(remaining);
      [c1, c2, c3, c4, c5].forEach(function (c) { row.appendChild(c); });
      host.appendChild(row);
    });
  }

  var travellerRows = [];

  function renderTravellers() {
    var tbody = els.travellersTable.querySelector('tbody');
    tbody.textContent = '';
    travellerRows = [];
    IPI.TRAVELLERS.forEach(function (t) {
      if (t.id === 'fiber' || t.id === 'coax') return;
      var tr = document.createElement('tr');
      if (t.id === 'light') tr.className = 'is-light';
      var td1 = document.createElement('td');
      td1.textContent = t.name;
      var td2 = document.createElement('td');
      td2.className = 'mono';
      td2.textContent = fmt.travellerSpeed(t.speedKmS) + (t.id === 'light' ? '' : ' · ' + fmt.percentOfLight(t.speedKmS));
      var td3 = document.createElement('td');
      td3.className = 'mono';
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tbody.appendChild(tr);
      travellerRows.push({ el: td3, speed: t.speedKmS });
    });
    updateTravellerTimes(distKm());
  }

  function updateTravellerTimes(d) {
    travellerRows.forEach(function (row) {
      util.setText(row.el, fmt.duration(d / row.speed));
    });
  }

  function renderFacts() {
    var host = els.facts;
    host.textContent = '';
    IPI.FACTS[sim.dest].forEach(function (fact) {
      var card = document.createElement('div');
      card.className = 'card';
      var h4 = document.createElement('h4');
      h4.textContent = fact.title;
      var p = document.createElement('p');
      p.textContent = fact.text;
      card.appendChild(h4);
      card.appendChild(p);
      host.appendChild(card);
    });
  }

  /* -------------------------------- Drawing ------------------------------- */

  function drawScene() {
    var ctx = scene.ctx;
    var W = scene.w;
    var H = scene.h;
    if (!W || !H) return;
    var reduced = util.reducedMotion();

    ctx.clearRect(0, 0, W, H);

    var dest = IPI.DEST[sim.dest];
    var trackY = H * 0.54;
    var rE = util.clamp(H * 0.17, 28, 56);
    var earthX = rE + 28;
    var rD = rE * dest.sizeRel;
    var destX = W - (rD + 28 + (sim.dest === 'proxima' ? 18 : 0));
    var trackStart = earthX + rE + 10;
    var trackEnd = destX - rD - 10;
    var trackLen = Math.max(1, trackEnd - trackStart);

    // track
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackStart, trackY);
    ctx.lineTo(trackEnd, trackY);
    ctx.stroke();

    // ticks
    var d = distKm();
    var o = owd();
    var fracs = W < 560 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    fracs.forEach(function (f) {
      var x = trackStart + trackLen * f;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, trackY - 5);
      ctx.lineTo(x, trackY + 5);
      ctx.stroke();
      ctx.fillStyle = '#6E7A92';
      var l1 = f === 0 ? '0 km' : fmt.distanceKm(d * f);
      var l2 = f === 0 ? '0 s' : fmt.duration(o * f);
      ctx.fillText(l1, x, trackY + 22);
      ctx.fillText(l2, x, trackY + 36);
    });

    // Earth
    drawEarth(ctx, earthX, trackY, rE, reduced);
    ctx.fillStyle = '#A9B4C8';
    ctx.font = '600 13px ' + bodyFont;
    ctx.textAlign = 'center';
    ctx.fillText('Earth', earthX, trackY + rE + 20);

    // Destination
    if (sim.dest === 'moon') drawMoon(ctx, destX, trackY, rD, reduced);
    else if (sim.dest === 'mars') drawMars(ctx, destX, trackY, rD, reduced);
    else drawProxima(ctx, destX, trackY, rD, reduced, realT);

    ctx.fillStyle = '#A9B4C8';
    ctx.fillText(dest.name, destX, trackY + rD + (sim.dest === 'proxima' ? 34 : 20));
    if (sim.dest === 'proxima') {
      ctx.fillStyle = '#6E7A92';
      ctx.font = '11px ' + bodyFont;
      ctx.fillText('Proxima b (planet)', destX, trackY + rD + 48);
    }

    // effects (rings)
    sim.effects.forEach(function (fx) {
      var p = fx.age / fx.dur;
      var x = fx.which === 'earth' ? earthX : destX;
      var y = trackY;
      var r = fx.r0 + (fx.r1 - fx.r0) * p;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // packets
    sim.packets.forEach(function (pk) {
      var total = pk.kind === 'ping' ? 2 * pk.owd : pk.owd;
      var q = util.clamp((sim.simT - pk.sentAt) / total, 0, 1);
      var pos;
      var color;
      if (pk.kind === 'packet') {
        pos = q;
        color = '#5CE1E6';
      } else if (q < 0.5) {
        pos = q * 2;
        color = '#FFB84D';
      } else {
        pos = 2 - 2 * q;
        color = '#4ADE80';
      }
      var x = trackStart + trackLen * util.clamp(pos, 0, 1);

      if (!reduced) {
        // trail behind direction of motion
        var movingRight = pk.kind === 'packet' || q < 0.5;
        var tx = movingRight ? x - 36 : x + 36;
        var grad = ctx.createLinearGradient(x, trackY, tx, trackY);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, trackY);
        ctx.lineTo(tx, trackY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, trackY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#A9B4C8';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'ping' ? '#' + pk.id + ' ping' : '#' + pk.id, x, trackY - 16);
    });
  }

  function drawEarth(ctx, x, y, r, reduced) {
    ctx.save();
    var grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#3FA0FF');
    grad.addColorStop(0.6, '#1458B8');
    grad.addColorStop(1, '#072A63');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.clip();
    var lands = [
      [[-0.55, -0.20], [-0.30, -0.55], [0.00, -0.45], [-0.10, -0.10], [-0.30, 0.20], [-0.50, 0.10]],
      [[0.20, -0.30], [0.55, -0.35], [0.70, 0.00], [0.45, 0.30], [0.30, 0.55], [0.15, 0.20]],
      [[-0.20, 0.45], [0.05, 0.60], [-0.05, 0.80], [-0.30, 0.70]]
    ];
    ctx.fillStyle = 'rgba(62,155,95,0.85)';
    lands.forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (pt, i) {
        var px = x + pt[0] * r;
        var py = y + pt[1] * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    if (!reduced) {
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(92,225,230,0.35)';
    }
    ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    if (!reduced) ctx.restore();
  }

  function drawMoon(ctx, x, y, r, reduced) {
    if (!reduced) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255,255,255,0.18)';
    }
    var grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#D9D9D9');
    grad.addColorStop(1, '#8E8E8E');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!reduced) ctx.restore();

    var craters = [
      [-0.30, -0.25, 0.18], [0.25, -0.35, 0.12], [0.35, 0.15, 0.20],
      [-0.20, 0.30, 0.14], [0.00, 0.00, 0.08], [-0.50, 0.00, 0.09]
    ];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    craters.forEach(function (c) {
      ctx.beginPath();
      ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawMars(ctx, x, y, r, reduced) {
    if (!reduced) {
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(232,132,90,0.4)';
    }
    var grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#E8845A');
    grad.addColorStop(0.6, '#B5482A');
    grad.addColorStop(1, '#7A2E18');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!reduced) ctx.restore();

    ctx.fillStyle = 'rgba(60,20,10,0.35)';
    ctx.save();
    ctx.translate(x - 0.20 * r, y + 0.10 * r);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.35 * r, 0.18 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(x + 0.30 * r, y - 0.20 * r);
    ctx.rotate(0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.20 * r, 0.12 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#F4EDE4';
    ctx.beginPath();
    ctx.ellipse(x, y - 0.88 * r, 0.35 * r, 0.10 * r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawProxima(ctx, x, y, r, reduced, tSec) {
    if (!reduced) {
      ctx.save();
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(255,90,54,0.6)';
    }
    var grad = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    grad.addColorStop(0, '#FFB199');
    grad.addColorStop(0.55, '#FF5A36');
    grad.addColorStop(1, '#B3260F');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!reduced) ctx.restore();

    // Proxima b
    var angle = tSec * Math.PI * 2 / 11.2;
    var px = x + Math.cos(angle) * 1.55 * r;
    var py = y + Math.sin(angle) * 1.55 * r * 0.5; // slight ellipse for depth
    ctx.fillStyle = '#8B5E3C';
    ctx.beginPath();
    ctx.arc(px, py, 0.2 * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C98A5A';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ----------------------------- Mars orbit ------------------------------- */

  function drawOrbit() {
    if (sim.dest !== 'mars' || !orbit || !orbit.isVisible || document.hidden) return;
    var ctx = orbit.ctx;
    var W = orbit.w;
    var H = orbit.h;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    var cx = W / 2;
    var cy = H / 2;
    var Re = 0.24 * Math.min(W, H);
    var Rm = 1.524 * Re;

    // Orbits
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, Re, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Rm, 0, Math.PI * 2);
    ctx.stroke();

    // Sun
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = 'rgba(255,209,102,0.8)';
    ctx.fillStyle = '#FFD166';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var theta = IPI.physics.marsTheta(sim.marsT);
    var aE = -Math.PI / 2;
    var ex = cx + Math.cos(aE) * Re;
    var ey = cy + Math.sin(aE) * Re;
    var mx = cx + Math.cos(aE + theta) * Rm;
    var my = cy + Math.sin(aE + theta) * Rm;

    // Link line
    ctx.strokeStyle = sim.marsT >= 0.97 ? '#FF6B6B' : 'rgba(92,225,230,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);

    // Planets
    ctx.fillStyle = '#3FA0FF';
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8845A';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#A9B4C8';
    ctx.font = '11px ' + bodyFont;
    ctx.textAlign = 'left';
    ctx.fillText('Earth', ex + 8, ey - 8);
    ctx.fillText('Mars', mx + 8, my - 8);

    els.marsConjunction.hidden = sim.marsT < 0.97;
  }

  /* --------------------------------- UI ----------------------------------- */

  function updateSliderFill() {
    var pct = (sim.marsT * 100).toFixed(2) + '%';
    els.marsSlider.style.setProperty('--fill', pct);
  }

  function syncPresets() {
    var match = null;
    if (Math.abs(sim.marsT - 0) < 0.0005) match = 'closest';
    else if (Math.abs(sim.marsT - IPI.MARS_T_AVG) < 0.0005) match = 'avg';
    else if (Math.abs(sim.marsT - 1) < 0.0005) match = 'farthest';
    presets.set(match);
  }

  IPI.simulator = {
    drawEarth: drawEarth,
    init: function () {
      els.canvas = document.getElementById('sim-canvas');
      els.badge = document.getElementById('sim-badge');
      els.sendBtn = document.getElementById('sim-send');
      els.pingBtn = document.getElementById('sim-ping');
      els.pauseBtn = document.getElementById('sim-pause');
      els.resetBtn = document.getElementById('sim-reset');
      els.speedReadout = document.getElementById('sim-speed-readout');
      els.slowWarning = document.getElementById('sim-slow-warning');
      els.marsPanel = document.getElementById('sim-mars-panel');
      els.marsSlider = document.getElementById('mars-slider');
      els.marsDistText = document.getElementById('mars-dist-text');
      els.marsCanvas = document.getElementById('mars-canvas');
      els.marsConjunction = document.getElementById('mars-conjunction');
      els.readDistance = document.getElementById('sim-read-distance');
      els.readOwd = document.getElementById('sim-read-owd');
      els.readRtt = document.getElementById('sim-read-rtt');
      els.readElapsed = document.getElementById('sim-read-elapsed');
      els.readLatest = document.getElementById('sim-read-latest');
      els.readLatestSub = document.createElement('p');
      els.readLatestSub.className = 'hint';
      els.readLatestSub.style.margin = '4px 0 0';
      els.readLatest.parentNode.appendChild(els.readLatestSub);
      els.recent = document.getElementById('sim-recent');
      els.terminal = document.getElementById('sim-terminal');
      els.clearBtn = document.getElementById('sim-clear');
      els.packetsList = document.getElementById('sim-packets');
      els.scaleDistance = document.getElementById('sim-scale-distance');
      els.scaleLaps = document.getElementById('sim-scale-laps');
      els.scaleLight = document.getElementById('sim-scale-light');
      els.travellersTable = document.getElementById('sim-travellers');
      els.convText = document.getElementById('sim-conv-text');
      els.aboutTitle = document.getElementById('sim-about-title');
      els.facts = document.getElementById('sim-facts');
      els.live = document.getElementById('sim-live');

      scene = util.canvas(els.canvas);
      orbit = util.canvas(els.marsCanvas);
      bodyFont = getComputedStyle(document.body).fontFamily;

      tabs = IPI.ui.createTabs(
        document.getElementById('sim-tabs'),
        IPI.DEST_ORDER.map(function (id) {
          return { id: id, label: IPI.DEST[id].name, sub: IPI.DEST[id].tabSub };
        }),
        function (id) {
          setDestination(id);
        },
        sim.dest
      );

      speedChips = IPI.ui.createSpeedChips(
        document.getElementById('sim-speed-chips'),
        function (mult) {
          sim.mult = mult;
          updateSpeedUI();
        },
        sim.mult,
        RECOMMENDED[sim.dest]
      );

      presets = IPI.ui.createSegmented(
        document.getElementById('mars-presets'),
        [
          { id: 'closest', label: 'Closest' },
          { id: 'avg', label: 'Average' },
          { id: 'farthest', label: 'Farthest' }
        ],
        function (id) {
          sim.marsT = id === 'closest' ? 0 : id === 'avg' ? IPI.MARS_T_AVG : 1;
          els.marsSlider.value = String(Math.round(sim.marsT * 1000));
          updateSliderFill();
          updateReadouts(true);
        },
        'avg'
      );

      els.marsSlider.addEventListener('input', function () {
        sim.marsT = Number(els.marsSlider.value) / 1000;
        updateSliderFill();
        syncPresets();
        updateReadouts(true);
      });

      els.sendBtn.addEventListener('click', function () {
        send('packet');
      });
      els.pingBtn.addEventListener('click', function () {
        send('ping');
      });
      els.pauseBtn.addEventListener('click', function () {
        sim.paused = !sim.paused;
        util.setText(els.pauseBtn, sim.paused ? 'Play' : 'Pause');
        updateBadge();
      });
      els.resetBtn.addEventListener('click', function () {
        resetConversation();
      });
      els.clearBtn.addEventListener('click', function () {
        sim.terminalLines = [];
        sim.pingHeaderShown = false;
        renderTerminal();
      });

      // initial state: Mars, Average, 100×, not paused
      els.marsSlider.value = String(Math.round(sim.marsT * 1000));
      updateSliderFill();
      setDestination('mars');

      util.observeVisible(document.getElementById('simulator'), function (v) {
        visible = v;
      });

      IPI.ticker.add(update);
    }
  };
})();
