/*
 * chat.js — Section 8.4: chat across space.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;
  var CONST = IPI.CONST;

  var MAX_MESSAGES = 40;

  var chat = {
    dest: 'mars',
    marsPreset: 'avg',
    mult: 100,
    paused: false,
    simT: 0,
    baseMs: Date.now(),
    messages: [],
    events: [],
    log: [],
    nextId: 1,
    fallbackIdx: 0,
    tipShown: false
  };

  var RECOMMENDED = { moon: 1, mars: 100, proxima: 100000000 };
  var MARS_KM = { closest: 54600000, avg: 225000000, farthest: 401000000 };

  var els = {};
  var tabs = null;
  var speedChips = null;
  var marsSeg = null;
  var visible = false;
  var envMap = {};
  var typingEl = null;

  /* ------------------------------ Distances ------------------------------ */

  function distKm() {
    if (chat.dest === 'moon') return 384400;
    if (chat.dest === 'mars') return MARS_KM[chat.marsPreset];
    return 4.2465 * 9460730472580.8;
  }

  function owd() {
    return distKm() / CONST.C_KM_S;
  }

  function persona() {
    return IPI.PERSONAS[chat.dest];
  }

  /* --------------------------------- Reset -------------------------------- */

  function resetConversation() {
    chat.simT = 0;
    chat.baseMs = Date.now();
    chat.messages = [];
    chat.events = [];
    chat.log = [];
    chat.nextId = 1;
    chat.fallbackIdx = 0;
    chat.tipShown = false;
    envMap = {};
    typingEl = null;
    els.tip.hidden = true;
    els.earthPane.textContent = '';
    els.destPane.textContent = '';
    els.timeline.textContent = '';
    clearEnvelopes();
    renderPanes(true);
    updateStats();
    updateBadges();
    updateClocks();
  }

  function setDestination(destId) {
    chat.dest = destId;
    chat.marsPreset = 'avg';
    var isMars = destId === 'mars';
    els.marsBlock.hidden = !isMars;
    els.marsHint.hidden = !isMars;
    if (isMars) marsSeg.set('avg');

    var p = persona();
    els.destName.textContent = p.name;
    els.destRole.textContent = p.role;
    els.destAvatar.textContent = p.initials;
    els.destAvatar.style.background = p.color;
    els.input.placeholder = 'Type a message to ' + p.first + '…';
    util.setText(els.laneOutTo, p.place);
    util.setText(els.laneInFrom, p.place);

    speedChips.setRecommended(RECOMMENDED[destId]);
    speedChips.set(RECOMMENDED[destId]);
    chat.mult = RECOMMENDED[destId];

    resetConversation();
    updateSpeedUI();
  }

  /* --------------------------------- Send --------------------------------- */

  function sendMessage(text) {
    text = (text || '').trim().slice(0, 140);
    if (!text) return;
    if (chat.messages.length >= MAX_MESSAGES) return;

    var o = owd();
    var reply = IPI.chooseReply(chat.dest, text, o, chat.fallbackIdx);
    if (reply.usedFallback) chat.fallbackIdx += 1;

    var thinkSec = 3 + 0.08 * reply.text.length;
    var m = {
      id: chat.nextId++,
      text: text,
      sentAt: chat.simT,
      owd: o,
      arriveAt: chat.simT + o,
      receiptAt: chat.simT + 2 * o,
      thinkSec: thinkSec,
      replyText: reply.text,
      replyReadyAt: chat.simT + o + thinkSec,
      replyArriveAt: chat.simT + o + thinkSec + o,
      replyReceived: false,
      bubbleMe: null,
      metaMe: null,
      barMe: null,
      bubbleThem: null,
      metaThem: null
    };
    chat.messages.push(m);

    // impatience tip: first send while an earlier message has no reply yet
    if (!chat.tipShown && chat.messages.length > 1) {
      for (var i = 0; i < chat.messages.length - 1; i++) {
        if (chat.simT < chat.messages[i].replyArriveAt) {
          chat.tipShown = true;
          els.tip.hidden = false;
          break;
        }
      }
    }

    scheduleEvents(m);
    renderPanes(false);
    updateStats();
    updateInputState();
  }

  function scheduleEvents(m) {
    chat.events.push({ time: m.sentAt, type: 'sent', m: m });
    chat.events.push({ time: m.arriveAt, type: 'received', m: m });
    chat.events.push({ time: m.replyReadyAt, type: 'replySent', m: m });
    chat.events.push({ time: m.replyArriveAt, type: 'replyArrive', m: m });
    chat.events.push({ time: m.receiptAt, type: 'receipt', m: m });
    chat.events.sort(function (a, b) {
      if (a.time !== b.time) return a.time - b.time;
      var order = { sent: 0, received: 1, replySent: 2, replyArrive: 3, receipt: 4 };
      return order[a.type] - order[b.type];
    });
  }

  function processEvents() {
    var changed = false;
    while (chat.events.length && chat.events[0].time <= chat.simT) {
      var ev = chat.events.shift();
      var m = ev.m;
      var p = persona();
      var text;
      var where;
      if (ev.type === 'sent') {
        text = 'You sent #' + m.id + ': “' + m.text + '”';
        where = 'earth';
      } else if (ev.type === 'received') {
        text = p.first + ' received #' + m.id;
        where = 'dest';
      } else if (ev.type === 'replySent') {
        text = p.first + ' sent a reply to #' + m.id;
        where = 'dest';
      } else if (ev.type === 'replyArrive') {
        text = 'You received ' + p.first + "'s reply to #" + m.id;
        where = 'earth';
        m.replyReceived = true;
        util.setText(els.live, 'New message from ' + p.first + ': ' + m.replyText);
      } else {
        text = 'You learned that #' + m.id + ' was delivered';
        where = 'earth';
      }
      chat.log.push({ t: ev.time, where: where, text: text });
      appendTimeline(chat.log[chat.log.length - 1]);
      changed = true;
      updateStats();
    }
    if (changed) renderPanes(false);
  }

  function appendTimeline(entry) {
    if (chat.log.length === 1) els.timeline.textContent = '';
    var li = document.createElement('li');
    var time = document.createElement('span');
    time.className = 'mono';
    time.textContent = fmt.elapsed(entry.t);
    var badge = document.createElement('span');
    badge.className = 'loc-badge';
    if (entry.where === 'earth') {
      badge.textContent = 'Earth';
      badge.style.color = '#5CE1E6';
    } else {
      badge.textContent = persona().place;
      badge.style.color = persona().color;
    }
    var text = document.createElement('span');
    text.textContent = entry.text;
    li.appendChild(time);
    li.appendChild(badge);
    li.appendChild(text);
    els.timeline.appendChild(li);
    els.timeline.scrollTop = els.timeline.scrollHeight;
  }

  /* ------------------------------ Pane render ------------------------------ */

  function renderPanes(full) {
    var p = persona();
    var o = owd();

    // Earth pane
    if (!chat.messages.length) {
      if (full || !els.earthPane.querySelector('.phone-empty')) {
        els.earthPane.textContent = '';
        var empty = document.createElement('p');
        empty.className = 'phone-empty';
        empty.textContent = 'No messages yet. Say hello — it will take ' + fmt.duration(o) + ' to arrive.';
        els.earthPane.appendChild(empty);
      }
    } else if (full || els.earthPane.querySelector('.phone-empty')) {
      els.earthPane.textContent = '';
    }

    // Destination pane
    var arrivedCount = 0;
    chat.messages.forEach(function (m) {
      if (chat.simT >= m.arriveAt) arrivedCount++;
    });
    if (!arrivedCount) {
      if (full || !els.destPane.querySelector('.phone-empty')) {
        els.destPane.textContent = '';
        var dempty = document.createElement('p');
        dempty.className = 'phone-empty';
        dempty.textContent = 'Waiting for your first message…';
        els.destPane.appendChild(dempty);
      }
    } else if (full || els.destPane.querySelector('.phone-empty')) {
      els.destPane.textContent = '';
    }

    chat.messages.forEach(function (m) {
      ensureBubbles(m);
    });
    updateTyping();
  }

  function ensureBubbles(m) {
    var p = persona();

    // your bubble on Earth pane
    if (!m.bubbleMe || !m.bubbleMe.isConnected) {
      if (els.earthPane.querySelector('.phone-empty')) els.earthPane.textContent = '';
      var wrap = document.createElement('div');
      wrap.className = 'bubble-wrap is-me';
      var bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.text;
      var meta = document.createElement('p');
      meta.className = 'bubble-meta';
      var metaText = document.createElement('span');
      var metaIcon = document.createElement('span');
      metaIcon.className = 'meta-icon';
      var metaSuffix = document.createElement('span');
      meta.appendChild(metaText);
      meta.appendChild(metaIcon);
      meta.appendChild(metaSuffix);
      var bar = document.createElement('div');
      bar.className = 'bubble-progress';
      bar.innerHTML = '<div class="bubble-progress-fill"></div>';
      wrap.appendChild(bubble);
      wrap.appendChild(meta);
      wrap.appendChild(bar);
      els.earthPane.appendChild(wrap);
      m.bubbleMe = wrap;
      m.metaMe = metaText;
      m.iconMe = metaIcon;
      m.suffixMe = metaSuffix;
      m.barMe = bar;
      els.earthPane.scrollTop = els.earthPane.scrollHeight;
    }

    // incoming message on destination pane (appears at arriveAt)
    if (chat.simT >= m.arriveAt && (!m.bubbleThem || !m.bubbleThem.isConnected)) {
      if (els.destPane.querySelector('.phone-empty')) els.destPane.textContent = '';
      var twrap = document.createElement('div');
      twrap.className = 'bubble-wrap is-them';
      var tbubble = document.createElement('div');
      tbubble.className = 'bubble';
      tbubble.textContent = m.text;
      var tmeta = document.createElement('p');
      tmeta.className = 'bubble-meta';
      twrap.appendChild(tbubble);
      twrap.appendChild(tmeta);
      els.destPane.appendChild(twrap);
      m.bubbleThem = twrap;
      m.metaThem = tmeta;
      els.destPane.scrollTop = els.destPane.scrollHeight;
    }

    // reply bubble on destination pane (appears at replyReadyAt)
    if (chat.simT >= m.replyReadyAt && (!m.bubbleReply || !m.bubbleReply.isConnected)) {
      if (els.destPane.querySelector('.phone-empty')) els.destPane.textContent = '';
      var rwrap = document.createElement('div');
      rwrap.className = 'bubble-wrap is-me';
      var rbubble = document.createElement('div');
      rbubble.className = 'bubble';
      rbubble.textContent = m.replyText;
      var rmeta = document.createElement('p');
      rmeta.className = 'bubble-meta';
      rwrap.appendChild(rbubble);
      rwrap.appendChild(rmeta);
      els.destPane.appendChild(rwrap);
      m.bubbleReply = rwrap;
      m.metaReply = rmeta;
      els.destPane.scrollTop = els.destPane.scrollHeight;
    }

    // reply bubble on Earth pane (appears at replyArriveAt)
    if (chat.simT >= m.replyArriveAt && (!m.bubbleReplyMe || !m.bubbleReplyMe.isConnected)) {
      if (els.earthPane.querySelector('.phone-empty')) els.earthPane.textContent = '';
      var emwrap = document.createElement('div');
      emwrap.className = 'bubble-wrap is-them';
      var embubble = document.createElement('div');
      embubble.className = 'bubble';
      embubble.textContent = m.replyText;
      var emmeta = document.createElement('p');
      emmeta.className = 'bubble-meta';
      emwrap.appendChild(embubble);
      emwrap.appendChild(emmeta);
      els.earthPane.appendChild(emwrap);
      m.bubbleReplyMe = emwrap;
      m.metaReplyMe = emmeta;
      els.earthPane.scrollTop = els.earthPane.scrollHeight;
    }
  }

  function updateTyping() {
    var needTyping = false;
    chat.messages.forEach(function (m) {
      if (chat.simT >= m.arriveAt && chat.simT < m.replyReadyAt) needTyping = true;
    });
    if (needTyping && !typingEl) {
      var emptyEl = els.destPane.querySelector('.phone-empty');
      if (emptyEl) emptyEl.parentNode.removeChild(emptyEl);
      typingEl = document.createElement('div');
      typingEl.className = 'typing';
      var dots = document.createElement('span');
      dots.className = 'typing-dots';
      for (var i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
      var label = document.createElement('span');
      label.textContent = 'typing…';
      typingEl.appendChild(dots);
      typingEl.appendChild(label);
      els.destPane.appendChild(typingEl);
    } else if (!needTyping && typingEl) {
      if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      typingEl = null;
    }
    if (typingEl) els.destPane.scrollTop = els.destPane.scrollHeight;
  }

  function updateMetas() {
    chat.messages.forEach(function (m) {
      if (!m.metaMe) return;
      var text;
      var showBar;
      if (chat.simT < m.arriveAt) {
        text = 'Sent ' + fmt.clock(chat.baseMs, m.sentAt) + ' · arrives ' +
          fmt.clock(chat.baseMs, m.arriveAt) + ' (in ' + fmt.duration(m.arriveAt - chat.simT) + ')';
        showBar = true;
        var frac = util.clamp((chat.simT - m.sentAt) / m.owd, 0, 1);
        var fill = m.barMe.firstChild;
        var pct = (frac * 100).toFixed(1) + '%';
        if (fill.style.width !== pct) fill.style.width = pct;
        util.setText(m.metaMe, text);
        util.setText(m.iconMe, '✓');
        util.setText(m.suffixMe, '');
        m.iconMe.classList.remove('is-double');
      } else if (chat.simT < m.receiptAt) {
        text = 'Sent ' + fmt.clock(chat.baseMs, m.sentAt) + ' · delivery receipt arrives in ' +
          fmt.duration(m.receiptAt - chat.simT);
        showBar = false;
        util.setText(m.metaMe, text);
        util.setText(m.iconMe, '✓');
        util.setText(m.suffixMe, '');
        m.iconMe.classList.remove('is-double');
      } else {
        util.setText(m.metaMe, 'Delivered');
        util.setText(m.iconMe, '✓✓');
        util.setText(m.suffixMe, ' · you learned this at ' + fmt.clock(chat.baseMs, m.receiptAt));
        m.iconMe.classList.add('is-double');
        showBar = false;
      }
      if (m.barMe.hidden === showBar) m.barMe.hidden = !showBar;

      if (m.metaThem) {
        util.setText(m.metaThem, 'Received ' + fmt.clock(chat.baseMs, m.arriveAt));
      }
      if (m.metaReply) {
        if (chat.simT < m.replyArriveAt) {
          util.setText(m.metaReply, 'Sent ' + fmt.clock(chat.baseMs, m.replyReadyAt) +
            ' · arrives in ' + fmt.duration(m.replyArriveAt - chat.simT));
        } else {
          util.setText(m.metaReply, 'Reached Earth ' + fmt.clock(chat.baseMs, m.replyArriveAt));
        }
      }
      if (m.metaReplyMe) {
        util.setText(m.metaReplyMe, 'Received ' + fmt.clock(chat.baseMs, m.replyArriveAt));
      }
    });
  }

  /* ------------------------------ Transit lane ----------------------------- */

  function clearEnvelopes() {
    Object.keys(envMap).forEach(function (key) {
      var e = envMap[key];
      if (e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
    });
    envMap = {};
  }

  function makeEnvelope(small) {
    var span = document.createElement('span');
    span.className = 'lane-env';
    var w = small ? 14 : 22;
    var h = small ? 10 : 16;
    span.innerHTML =
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 22 16" fill="none">' +
      '<rect x="1" y="1" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.5" fill="rgba(4,6,13,0.9)"/>' +
      '<path d="M2 3l9 6 9-6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    return span;
  }

  function updateEnvelopes() {
    var wanted = {};
    chat.messages.forEach(function (m) {
      if (chat.simT >= m.sentAt && chat.simT < m.arriveAt) {
        wanted['m' + m.id + '-out'] = { track: 'out', from: m.sentAt, to: m.arriveAt, small: false, color: '#5CE1E6' };
      }
      if (chat.simT >= m.arriveAt && chat.simT < m.receiptAt) {
        wanted['m' + m.id + '-rcpt'] = { track: 'back', from: m.arriveAt, to: m.receiptAt, small: true, color: 'rgba(255,184,77,0.7)' };
      }
      if (chat.simT >= m.replyReadyAt && chat.simT < m.replyArriveAt) {
        wanted['m' + m.id + '-reply'] = { track: 'back', from: m.replyReadyAt, to: m.replyArriveAt, small: false, color: '#FFB84D' };
      }
    });

    Object.keys(envMap).forEach(function (key) {
      if (!wanted[key]) {
        var e = envMap[key];
        if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
        delete envMap[key];
      }
    });

    Object.keys(wanted).forEach(function (key) {
      var spec = wanted[key];
      var entry = envMap[key];
      if (!entry) {
        var el = makeEnvelope(spec.small);
        el.style.color = spec.color;
        var track = spec.track === 'out' ? els.trackOut : els.trackBack;
        track.appendChild(el);
        entry = envMap[key] = { el: el };
      }
      var prog = util.clamp((chat.simT - spec.from) / Math.max(1e-9, spec.to - spec.from), 0, 1);
      entry.el.style.left = (prog * 100).toFixed(2) + '%';
    });
  }

  /* -------------------------------- Update --------------------------------- */

  function update(dtReal) {
    if (!chat.paused) chat.simT += dtReal * chat.mult;
    processEvents();
    if (visible && !document.hidden) {
      updateMetas();
      updateEnvelopes();
      updateClocks();
      updateStats();
      updateBadges();
    }
  }

  function updateClocks() {
    var label = 'Simulated clock: ' + fmt.clock(chat.baseMs, chat.simT);
    util.setText(els.earthClock, label);
    util.setText(els.destClock, label);
  }

  function updateBadges() {
    var p = persona();
    var o = owd();
    util.setText(els.earthBadge, 'You see ' + p.place + ' as it was ' + fmt.duration(o) + ' ago');
    util.setText(els.destBadge, 'They see Earth as it was ' + fmt.duration(o) + ' ago');
  }

  function updateStats() {
    var o = owd();
    var replies = 0;
    var latestPending = null;
    chat.messages.forEach(function (m) {
      if (m.replyReceived) replies++;
      latestPending = m;
    });
    util.setText(els.statSent, String(chat.messages.length));
    util.setText(els.statReplies, String(replies));
    util.setText(els.statRtt, fmt.duration(2 * o));
    util.setText(els.statFastest, fmt.duration(2 * o + 3));
    if (latestPending && chat.simT < latestPending.replyArriveAt) {
      util.setText(els.statLatest, fmt.duration(latestPending.replyArriveAt - chat.simT));
    } else {
      util.setText(els.statLatest, '—');
    }

    var wait = o / chat.mult;
    if (wait > 120) {
      els.slowWarning.hidden = false;
      util.setText(els.slowWarning, 'At this speed one message needs ' + fmt.duration(wait) +
        ' of your time to arrive. Try a faster speed — the ★ chip is a good start.');
    } else {
      els.slowWarning.hidden = true;
    }
  }

  function updateBadge() {
    util.setText(els.badge, fmt.speedBadge(chat.mult, chat.paused));
    els.badge.className = 'badge ' + (chat.paused ? 'badge-paused' : chat.mult === 1 ? 'badge-real' : 'badge-fast');
  }

  function updateSpeedUI() {
    util.setText(els.speedReadout, fmt.multiplierReadout(chat.mult));
    updateBadge();
    updateStats();
  }

  function updateInputState() {
    var limitReached = chat.messages.length >= MAX_MESSAGES;
    els.input.disabled = limitReached;
    if (limitReached) {
      els.input.placeholder = 'Conversation limit reached — press Reset conversation';
    } else {
      els.input.placeholder = 'Type a message to ' + persona().first + '…';
    }
    els.sendBtn.disabled = limitReached || !els.input.value.trim();
  }

  /* --------------------------------- UI ----------------------------------- */

  function sendFromInput() {
    var text = els.input.value;
    if (!text.trim() || chat.messages.length >= MAX_MESSAGES) return;
    sendMessage(text);
    els.input.value = '';
    util.setText(els.counter, '0/140');
    updateInputState();
  }

  IPI.chat = {
    init: function () {
      els.tabsHost = document.getElementById('chat-tabs');
      els.badge = document.getElementById('chat-badge');
      els.marsBlock = document.getElementById('chat-mars');
      els.marsHint = document.getElementById('chat-mars-hint');
      els.speedReadout = document.getElementById('chat-speed-readout');
      els.slowWarning = document.getElementById('chat-slow-warning');
      els.pauseBtn = document.getElementById('chat-pause');
      els.resetBtn = document.getElementById('chat-reset');
      els.trackOut = document.getElementById('chat-track-out');
      els.trackBack = document.getElementById('chat-track-back');
      els.laneOutTo = document.getElementById('chat-lane-out-to');
      els.laneInFrom = document.getElementById('chat-lane-in-from');
      els.earthPane = document.getElementById('chat-earth-pane');
      els.destPane = document.getElementById('chat-dest-pane');
      els.earthClock = document.getElementById('chat-earth-clock');
      els.destClock = document.getElementById('chat-dest-clock');
      els.earthBadge = document.getElementById('chat-earth-badge');
      els.destBadge = document.getElementById('chat-dest-badge');
      els.destName = document.getElementById('chat-dest-name');
      els.destRole = document.getElementById('chat-dest-role');
      els.destAvatar = document.getElementById('chat-dest-avatar');
      els.quick = document.getElementById('chat-quick');
      els.input = document.getElementById('chat-input');
      els.sendBtn = document.getElementById('chat-send');
      els.counter = document.getElementById('chat-counter');
      els.tip = document.getElementById('chat-tip');
      els.statSent = document.getElementById('chat-stat-sent');
      els.statReplies = document.getElementById('chat-stat-replies');
      els.statRtt = document.getElementById('chat-stat-rtt');
      els.statFastest = document.getElementById('chat-stat-fastest');
      els.statLatest = document.getElementById('chat-stat-latest');
      els.timeline = document.getElementById('chat-timeline');
      els.live = document.getElementById('chat-live');

      tabs = IPI.ui.createTabs(
        els.tabsHost,
        IPI.DEST_ORDER.map(function (id) {
          return { id: id, label: IPI.DEST[id].name, sub: IPI.DEST[id].tabSub };
        }),
        function (id) {
          setDestination(id);
        },
        chat.dest
      );

      marsSeg = IPI.ui.createSegmented(
        els.marsBlock,
        [
          { id: 'closest', label: 'Closest · ' + fmt.duration(MARS_KM.closest / CONST.C_KM_S) },
          { id: 'avg', label: 'Average · ' + fmt.duration(MARS_KM.avg / CONST.C_KM_S) },
          { id: 'farthest', label: 'Farthest · ' + fmt.duration(MARS_KM.farthest / CONST.C_KM_S) }
        ],
        function (id) {
          chat.marsPreset = id;
          updateBadges();
          updateStats();
        },
        'avg'
      );

      speedChips = IPI.ui.createSpeedChips(
        document.getElementById('chat-speed-chips'),
        function (mult) {
          chat.mult = mult;
          updateSpeedUI();
        },
        chat.mult,
        RECOMMENDED[chat.dest]
      );

      IPI.QUICK_MESSAGES.forEach(function (msg) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = msg;
        b.addEventListener('click', function () {
          els.input.value = msg;
          util.setText(els.counter, msg.length + '/140');
          sendFromInput();
        });
        els.quick.appendChild(b);
      });

      els.input.addEventListener('input', function () {
        util.setText(els.counter, els.input.value.length + '/140');
        updateInputState();
      });
      els.input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendFromInput();
        }
      });
      els.sendBtn.addEventListener('click', sendFromInput);

      els.pauseBtn.addEventListener('click', function () {
        chat.paused = !chat.paused;
        util.setText(els.pauseBtn, chat.paused ? 'Play' : 'Pause');
        updateBadge();
      });
      els.resetBtn.addEventListener('click', function () {
        resetConversation();
      });

      setDestination('mars');

      util.observeVisible(document.getElementById('chat'), function (v) {
        visible = v;
      });

      IPI.ticker.add(update);
    }
  };
})();
