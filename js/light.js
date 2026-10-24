/*
 * light.js — Section 8.5: the speed of light.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;
  var CONST = IPI.CONST;

  var LAPS_PER_SECOND = CONST.C_KM_S / 40075; // ≈ 7.48

  var RACE_DIST = {
    moon: 384400,
    mars: 225000000,
    proxima: 4.2465 * 9460730472580.8
  };
  var RACE_RECOMMENDED = { moon: 1, mars: 100, proxima: 10000000 };

  var BP_DEST = {
    moon: { label: 'Moon', km: 384400 },
    mars: { label: 'Mars (average)', km: 225000000 },
    proxima: { label: 'Proxima Centauri', km: 4.2465 * 9460730472580.8 }
  };
  var BP_SIZE = {
    mb: { label: '1 MB', bits: 8e6 },
    gb: { label: '1 GB', bits: 8e9 },
    tb: { label: '1 TB', bits: 8e12 }
  };

  /* ================================================================== *
   * 8.5.A Light, lap by lap
   * ================================================================== */

  var lap = {
    speedFactor: 0.1, // default "Slow motion (1/10)"
    t: 0, // accumulated real seconds at current speed setting
    reduced: false
  };
  var lapEls = {};
  var lapCanvas = null;
  var lapSeg = null;

  function updateLapCounter() {
    if (lap.reduced) return;
    var n = Math.floor(lap.t * LAPS_PER_SECOND * lap.speedFactor);
    util.setText(lapEls.counter, 'Laps completed: ' + n.toLocaleString('en-US'));
  }

  function drawLap(dtReal) {
    if (!lapCanvas) return;
    if (!lap.reduced) lap.t += dtReal;
    var ctx = lapCanvas.ctx;
    var W = lapCanvas.w;
    var H = lapCanvas.h;
    ctx.clearRect(0, 0, W, H);
    var cx = W / 2;
    var cy = H / 2;
    var size = Math.min(W, H);
    var rEarth = 0.26 * size;
    var rOrbit = 0.38 * size;

    // orbit line
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rOrbit, 0, Math.PI * 2);
    ctx.stroke();

    // Earth (same procedural art as the simulator)
    IPI.simulator.drawEarth(ctx, cx, cy, rEarth, lap.reduced);

    // light dot
    var angle;
    if (lap.reduced) {
      angle = -Math.PI / 2; // static at the top
    } else {
      angle = lap.t * 2 * Math.PI * LAPS_PER_SECOND * lap.speedFactor - Math.PI / 2;
    }
    var dx = cx + Math.cos(angle) * rOrbit;
    var dy = cy + Math.sin(angle) * rOrbit;

    ctx.save();
    if (!lap.reduced) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(92,225,230,0.8)';
    }
    ctx.fillStyle = '#5CE1E6';
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!lap.reduced) updateLapCounter();
  }

  /* ================================================================== *
   * 8.5.B The Light Race
   * ================================================================== */

  var race = {
    dest: 'mars',
    mult: 100,
    running: false,
    raceT: 0,
    finishCount: 0,
    lanes: [] // { racer, totalSeconds, finished, place }
  };
  var raceEls = {};
  var raceTabs = null;
  var raceChips = null;
  var raceVisible = false;

  function ordinal(n) {
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + 'th';
    if (n % 10 === 1) return n + 'st';
    if (n % 10 === 2) return n + 'nd';
    if (n % 10 === 3) return n + 'rd';
    return n + 'th';
  }

  function buildRaceLanes() {
    raceEls.lanes.textContent = '';
    race.lanes = IPI.TRAVELLERS.map(function (racer) {
      var total = RACE_DIST[race.dest] / racer.speedKmS;
      var lane = document.createElement('div');
      lane.className = 'race-lane';

      var info = document.createElement('div');
      var name = document.createElement('p');
      name.className = 'race-name';
      var dot = document.createElement('span');
      dot.className = 'race-dot';
      dot.style.background = racer.color;
      name.appendChild(dot);
      name.appendChild(document.createTextNode(racer.name));
      info.appendChild(name);
      var sub = document.createElement('p');
      sub.className = 'race-sub';
      sub.textContent = fmt.travellerSpeed(racer.speedKmS) + ' · ' + fmt.percentOfLight(racer.speedKmS) + ' of c';
      info.appendChild(sub);

      var trackWrap = document.createElement('div');
      var track = document.createElement('div');
      track.className = 'race-track';
      var fill = document.createElement('div');
      fill.className = 'race-fill';
      fill.style.background = racer.color;
      var flag = document.createElement('span');
      flag.className = 'race-flag';
      flag.textContent = '⚑';
      track.appendChild(fill);
      track.appendChild(flag);
      trackWrap.appendChild(track);
      var position = document.createElement('p');
      position.className = 'race-position';
      position.textContent = 'Position: ' + fmt.distanceKm(0);
      trackWrap.appendChild(position);

      var status = document.createElement('p');
      status.className = 'race-status';
      status.textContent = 'Finishes in ' + fmt.duration(total);

      lane.appendChild(info);
      lane.appendChild(trackWrap);
      lane.appendChild(status);
      raceEls.lanes.appendChild(lane);

      return {
        racer: racer,
        totalSeconds: total,
        finished: false,
        place: 0,
        fill: fill,
        status: status,
        position: position
      };
    });
  }

  function resetRace() {
    race.running = false;
    race.raceT = 0;
    race.finishCount = 0;
    race.lanes.forEach(function (lane) {
      lane.finished = false;
      lane.place = 0;
      lane.fill.style.transform = 'scaleX(0)';
      util.setText(lane.status, 'Finishes in ' + fmt.duration(lane.totalSeconds));
      util.setText(lane.position, 'Position: ' + fmt.distanceKm(0));
    });
    util.setText(raceEls.clock, 'Race clock: ' + fmt.elapsed(0));
    updateRaceBadge();
  }

  function updateRaceBadge() {
    util.setText(raceEls.badge, fmt.speedBadge(race.mult, !race.running));
    raceEls.badge.className = 'badge ' +
      (!race.running ? 'badge-paused' : race.mult === 1 ? 'badge-real' : 'badge-fast');
    util.setText(raceEls.speedReadout, fmt.multiplierReadout(race.mult));
  }

  function updateRace(dtReal) {
    if (race.running) race.raceT += dtReal * race.mult;
    if (race.running) {
      util.setText(raceEls.clock, 'Race clock: ' + fmt.elapsed(race.raceT));
      race.lanes.forEach(function (lane) {
        if (lane.finished) return;
        var progress = util.clamp(race.raceT / lane.totalSeconds, 0, 1);
        lane.fill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
        util.setText(lane.position, 'Position: ' + fmt.distanceKm(progress * RACE_DIST[race.dest]));
        if (progress >= 1) {
          lane.finished = true;
          race.finishCount += 1;
          lane.place = race.finishCount;
          util.setText(lane.status, 'Finished ✓ ' + ordinal(lane.place));
        } else {
          var remaining = lane.totalSeconds - race.raceT;
          util.setText(lane.status, fmt.duration(remaining) + ' left');
        }
      });
    }
  }

  /* ================================================================== *
   * 8.5.C The Latency Ladder
   * ================================================================== */

  var RULER_TICKS = [
    { t: 1e-8, label: '10 ns' },
    { t: 1e-6, label: '1 µs' },
    { t: 1e-3, label: '1 ms' },
    { t: 1, label: '1 s' },
    { t: 60, label: '1 min' },
    { t: 3600, label: '1 h' },
    { t: 86400, label: '1 day' },
    { t: 31557600, label: '1 year' },
    { t: 3.15576e13, label: '1 million years' }
  ];

  function rulerPos(t) {
    return ((Math.log10(t) + 8) / 22) * 100;
  }

  function buildLadder() {
    var ruler = document.getElementById('ladder-ruler');
    var host = document.getElementById('ladder-rows');
    var ladder = document.getElementById('ladder');

    RULER_TICKS.forEach(function (tick) {
      var span = document.createElement('span');
      span.textContent = tick.label;
      span.style.left = rulerPos(tick.t) + '%';
      ruler.appendChild(span);
    });

    // gridlines run down through all rows (absolute inside .ladder)
    RULER_TICKS.forEach(function (tick) {
      var line = document.createElement('div');
      line.className = 'ladder-gridline';
      // bar area starts after the 240 px label column (+16 px gap) and
      // ends 220 px from the right edge, matching .ladder-ruler margins
      line.style.left = 'calc(240px + (100% - 460px) * ' + (rulerPos(tick.t) / 100) + ')';
      ladder.appendChild(line);
    });

    var bars = [];
    IPI.LADDER.forEach(function (row) {
      var seconds = IPI.ladderSeconds(row);
      var rtt = 2 * seconds;
      var cat = IPI.ladderCategory(rtt);

      var el = document.createElement('div');
      el.className = 'ladder-row';

      var labelCell = document.createElement('div');
      var label = document.createElement('p');
      label.className = 'ladder-label';
      label.textContent = row.label;
      labelCell.appendChild(label);
      var dist = document.createElement('p');
      dist.className = 'ladder-dist';
      dist.textContent = IPI.ladderDistanceText(row) + (row.note ? ' · ' + row.note : '');
      labelCell.appendChild(dist);

      var barCell = document.createElement('div');
      barCell.className = 'ladder-bar-track';
      var bar = document.createElement('div');
      bar.className = 'ladder-bar';
      bar.style.background = cat.color;
      barCell.appendChild(bar);

      var oneWay = document.createElement('p');
      oneWay.className = 'ladder-time';
      oneWay.textContent = fmt.duration(seconds);

      var roundTrip = document.createElement('p');
      roundTrip.className = 'ladder-rtt';
      roundTrip.textContent = fmt.duration(rtt);

      var chip = document.createElement('span');
      chip.className = 'cat-chip';
      chip.style.color = cat.color;
      chip.textContent = cat.text;

      el.appendChild(labelCell);
      el.appendChild(barCell);
      el.appendChild(oneWay);
      el.appendChild(roundTrip);
      el.appendChild(chip);
      host.appendChild(el);

      bars.push({ bar: bar, frac: IPI.ladderBarFraction(seconds) });
    });

    // animate widths the first time the block scrolls into view
    var animated = false;
    util.observeVisible(ladder, function (v) {
      if (!v || animated) return;
      animated = true;
      bars.forEach(function (item) {
        item.bar.style.width = (item.frac * 100).toFixed(2) + '%';
      });
    });
  }

  /* ================================================================== *
   * 8.5.D Bigger pipe, same delay
   * ================================================================== */

  var bp = {
    dest: 'mars',
    size: 'gb',
    exponent: 6
  };
  var bpEls = {};
  var bpDestSeg = null;
  var bpSizeSeg = null;

  function updateBandwidth() {
    var bps = Math.pow(10, bp.exponent);
    var travel = BP_DEST[bp.dest].km / CONST.C_KM_S;
    var transfer = BP_SIZE[bp.size].bits / bps;
    var total = travel + transfer;
    var travelShare = travel / total;
    var transferShare = transfer / total;

    util.setText(bpEls.bpsLabel, fmt.bitrate(bps));
    if (Number(bpEls.slider.value) !== bp.exponent) {
      bpEls.slider.value = String(bp.exponent);
    }

    // stacked bar
    var travelPct = (travelShare * 100).toFixed(2) + '%';
    var transferPct = (transferShare * 100).toFixed(2) + '%';
    bpEls.barTravel.style.width = travelShare > 0 ? 'max(2px, ' + travelPct + ')' : '0';
    bpEls.barTransfer.style.width = transferShare > 0 ? 'max(2px, ' + transferPct + ')' : '0';
    util.setText(bpEls.travelLabel, travelShare > 0.18 ? travelPct : '');
    util.setText(bpEls.transferLabel, transferShare > 0.18 ? transferPct : '');

    util.setText(bpEls.readTravel, fmt.duration(travel));
    util.setText(bpEls.readTransfer, fmt.duration(transfer));
    util.setText(bpEls.readTotal, fmt.duration(total));

    var message;
    if (travelShare >= 0.99) {
      message = "You've hit the latency floor. A bigger pipe no longer helps — the only thing left is the light itself.";
    } else if (transferShare >= 0.9) {
      message = 'Bandwidth is the bottleneck here. Upgrading the link would help a lot.';
    } else {
      message = 'Both matter. Bandwidth and distance each take a share.';
    }
    util.setText(bpEls.message, message);
  }

  /* ================================================================== *
   * Init
   * ================================================================== */

  IPI.light = {
    init: function () {
      /* --- A: light laps --- */
      lapEls.mode = document.getElementById('lap-mode');
      lapEls.counter = document.getElementById('lap-counter');
      lapEls.reduced = document.getElementById('lap-reduced');
      lap.reduced = util.reducedMotion();

      lapCanvas = util.canvas(document.getElementById('lap-canvas'));

      lapSeg = IPI.ui.createSegmented(
        lapEls.mode,
        [
          { id: 'real', label: 'Real speed' },
          { id: 'slow', label: 'Slow motion (1/10)' }
        ],
        function (id) {
          lap.speedFactor = id === 'real' ? 1 : 0.1;
          lap.t = 0;
          updateLapCounter();
        },
        'slow'
      );

      if (lap.reduced) {
        lapEls.counter.hidden = true;
        lapEls.reduced.hidden = false;
      }

      /* --- B: the light race --- */
      raceEls.tabs = document.getElementById('race-tabs');
      raceEls.start = document.getElementById('race-start');
      raceEls.reset = document.getElementById('race-reset');
      raceEls.chips = document.getElementById('race-speed-chips');
      raceEls.speedReadout = document.getElementById('race-speed-readout');
      raceEls.badge = document.getElementById('race-badge');
      raceEls.clock = document.getElementById('race-clock');
      raceEls.lanes = document.getElementById('race-lanes');

      raceTabs = IPI.ui.createTabs(
        raceEls.tabs,
        [
          { id: 'moon', label: 'Moon', sub: '384,400 km' },
          { id: 'mars', label: 'Mars (average distance)', sub: '225 million km' },
          { id: 'proxima', label: 'Proxima Centauri', sub: '4.2465 light-years' }
        ],
        function (id) {
          race.dest = id;
          raceChips.setRecommended(RACE_RECOMMENDED[id]);
          buildRaceLanes();
          resetRace();
        },
        race.dest
      );

      raceChips = IPI.ui.createSpeedChips(
        raceEls.chips,
        function (mult) {
          race.mult = mult;
          updateRaceBadge();
        },
        race.mult,
        RACE_RECOMMENDED[race.dest]
      );

      raceEls.start.addEventListener('click', function () {
        race.running = true;
        race.raceT = 0;
        race.finishCount = 0;
        race.lanes.forEach(function (lane) {
          lane.finished = false;
          lane.place = 0;
          lane.fill.style.transform = 'scaleX(0)';
        });
        updateRaceBadge();
      });
      raceEls.reset.addEventListener('click', resetRace);

      buildRaceLanes();
      resetRace();

      util.observeVisible(document.getElementById('light'), function (v) {
        raceVisible = v;
      });

      /* --- C: latency ladder --- */
      buildLadder();

      /* --- D: bigger pipe --- */
      bpEls.dest = document.getElementById('bp-dest');
      bpEls.size = document.getElementById('bp-size');
      bpEls.slider = document.getElementById('bp-slider');
      bpEls.bpsLabel = document.getElementById('bp-bps-label');
      bpEls.barTravel = document.getElementById('bp-bar-travel');
      bpEls.barTransfer = document.getElementById('bp-bar-transfer');
      bpEls.travelLabel = document.getElementById('bp-travel-label');
      bpEls.transferLabel = document.getElementById('bp-transfer-label');
      bpEls.readTravel = document.getElementById('bp-read-travel');
      bpEls.readTransfer = document.getElementById('bp-read-transfer');
      bpEls.readTotal = document.getElementById('bp-read-total');
      bpEls.message = document.getElementById('bp-message');
      bpEls.presetVoyager = document.getElementById('bp-preset-voyager');
      bpEls.presetLaser = document.getElementById('bp-preset-laser');
      bpEls.presetFiber = document.getElementById('bp-preset-fiber');

      bpDestSeg = IPI.ui.createSegmented(
        bpEls.dest,
        [
          { id: 'moon', label: 'Moon' },
          { id: 'mars', label: 'Mars (average)' },
          { id: 'proxima', label: 'Proxima Centauri' }
        ],
        function (id) {
          bp.dest = id;
          updateBandwidth();
        },
        bp.dest
      );

      bpSizeSeg = IPI.ui.createSegmented(
        bpEls.size,
        [
          { id: 'mb', label: '1 MB' },
          { id: 'gb', label: '1 GB' },
          { id: 'tb', label: '1 TB' }
        ],
        function (id) {
          bp.size = id;
          updateBandwidth();
        },
        bp.size
      );

      bpEls.slider.addEventListener('input', function () {
        bp.exponent = Number(bpEls.slider.value);
        updateBandwidth();
      });

      function setExponent(e) {
        bp.exponent = util.clamp(e, 2, 13);
        bpEls.slider.value = String(bp.exponent);
        updateBandwidth();
      }
      bpEls.presetVoyager.addEventListener('click', function () {
        setExponent(Math.log10(160));
      });
      bpEls.presetLaser.addEventListener('click', function () {
        setExponent(Math.log10(267e6));
      });
      bpEls.presetFiber.addEventListener('click', function () {
        setExponent(9);
      });

      updateBandwidth();

      /* --- shared ticker --- */
      IPI.ticker.add(function (dtReal) {
        if (!document.hidden) {
          drawLap(dtReal);
          if (raceVisible) updateRace(dtReal);
        }
      });
    }
  };
})();
