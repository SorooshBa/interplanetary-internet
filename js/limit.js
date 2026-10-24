/*
 * limit.js — Section 8.6: the cosmic speed limit.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;
  var physics = IPI.physics;

  /* ================================================================== *
   * 8.6.A The energy wall
   * ================================================================== */

  var wallEls = {};

  function updateWall() {
    var s = Number(wallEls.slider.value);
    var w = physics.wall(s);
    var epsilon = w.epsilon;
    var gamma = w.gamma;
    var ke = w.ke;

    // 1. Speed
    if (s <= 0) {
      util.setText(wallEls.speed, '0% — at rest');
    } else {
      util.setText(wallEls.speed, fmt.percentOfC(epsilon) + ' of light speed');
    }

    // 2. Gap to light speed (spec formula, literal)
    if (s <= 0) {
      util.setText(wallEls.gap, '—');
    } else {
      var gapKmS = epsilon * 299792.458;
      if (gapKmS < 1) {
        util.setText(wallEls.gap, fmt.sig3(gapKmS) + ' m/s');
      } else {
        util.setText(wallEls.gap, fmt.sig3(gapKmS) + ' km/s');
      }
    }

    // 3. Lorentz factor
    util.setText(wallEls.gamma, fmt.sig3(gamma));

    // 4. Energy (scientific with superscript exponent)
    var sci = fmt.scientific(ke);
    if (ke === 0) {
      util.setText(wallEls.energy, '0 J');
      util.setText(wallEls.energySub, '');
    } else {
      wallEls.energy.textContent = '';
      wallEls.energy.appendChild(document.createTextNode(sci.mantissa + ' × 10'));
      var sup = document.createElement('sup');
      sup.textContent = String(sci.exponent);
      wallEls.energy.appendChild(sup);
      wallEls.energy.appendChild(document.createTextNode(' J'));
      util.setText(wallEls.energySub, 'joules');
    }

    // 5. Comparison
    util.setText(wallEls.compare, compareEnergy(ke));

    // 6. Trip to Proxima Centauri
    var beta = w.beta;
    if (beta < 0.001) {
      util.setText(wallEls.trip, '—');
    } else {
      var proximaSec = 4.2465 * 31557600;
      wallEls.trip.textContent = '';
      var l1 = document.createElement('span');
      l1.textContent = 'Earth clocks: ' + fmt.duration(proximaSec / beta);
      var br = document.createElement('br');
      var l2 = document.createElement('span');
      l2.textContent = 'Ship clocks: ' + fmt.duration(proximaSec / beta / gamma);
      wallEls.trip.appendChild(l1);
      wallEls.trip.appendChild(br);
      wallEls.trip.appendChild(l2);
    }

    // visual marker
    wallEls.marker.style.left = (s * 100).toFixed(2) + '%';
  }

  function compareEnergy(ke) {
    if (ke >= 6.2e20) return fmt.sig3(ke / 6.2e20) + " years of the world's total energy use";
    if (ke >= 6.3e13) return fmt.compact(ke / 6.3e13) + ' Hiroshima bombs';
    if (ke >= 4.184e9) return fmt.compact(ke / 4.184e9) + ' tonnes of TNT';
    if (ke >= 3.4e7) return fmt.compact(ke / 3.4e7) + ' liters of gasoline';
    return 'less than a liter of gasoline';
  }

  /* ================================================================== *
   * 8.6.B The causality story
   * ================================================================== */

  var CAUSAL_STEPS = [
    {
      title: 'Alice asks a question',
      text: 'Alice stands at the origin. At time zero she sends a message to Bob, who is 2 light-seconds away. In this diagram time goes up and distance goes to the right, and light always travels along the dashed 45° lines.'
    },
    {
      title: 'A faster-than-light signal',
      text: 'Suppose her message travels at twice the speed of light. It crosses the 2 light-seconds in just 1 second and reaches Bob at event B. A faster-than-light signal is a line flatter than the dashed light rays.'
    },
    {
      title: 'Bob replies from a moving ship',
      text: 'Bob is on a spaceship moving away from Alice at 90% of light speed. In his own frame of reference he sends his answer back toward Alice, also at twice light speed. Nothing odd happens from Bob\u2019s point of view.'
    },
    {
      title: 'The reply arrives first',
      text: "Measured in Alice's frame, the reply reaches her 0.45 seconds before she sent her question. The answer exists before the question. (Numbers: v = 0.9 c, \u03b3 \u2248 2.29.)"
    },
    {
      title: 'Why physics forbids it',
      text: 'If this were possible, Alice could read the reply and then decide not to ask \u2014 a paradox. Physics avoids it by forbidding signals faster than light. Every experiment so far agrees.'
    }
  ];

  var causal = { step: 1 };
  var causalEls = {};

  function setStep(n) {
    causal.step = util.clamp(n, 1, 5);
    causalEls.svg.setAttribute('data-step', String(causal.step));
    var step = CAUSAL_STEPS[causal.step - 1];
    util.setText(causalEls.title, step.title);
    util.setText(causalEls.text, step.text);
    util.setText(causalEls.counter, 'Step ' + causal.step + ' of 5');
    for (var i = 0; i < causalEls.dots.length; i++) {
      causalEls.dots[i].classList.toggle('is-active', i === causal.step - 1);
    }
    causalEls.prev.disabled = causal.step === 1;
    util.setText(causalEls.next, causal.step === 5 ? 'Start over' : 'Next');
  }

  /* ================================================================== *
   * 8.6.C.1 Entanglement demo
   * ================================================================== */

  var ent = {
    setting: 'z',
    alice: null,
    bob: null,
    compared: false
  };
  var entEls = {};
  var entSeg = null;

  function runPairs() {
    var alice = [];
    var bob = [];
    for (var i = 0; i < 20; i++) {
      var a = Math.random() < 0.5 ? 0 : 1;
      var b = ent.setting === 'z' ? a : (Math.random() < 0.5 ? 0 : 1);
      alice.push(a);
      bob.push(b);
    }
    ent.alice = alice;
    ent.bob = bob;
    ent.compared = false;
    entEls.compare.disabled = false;
    entEls.summary.hidden = true;
    entEls.summary.textContent = '';
    renderBits();
  }

  function renderBits() {
    renderRow(entEls.aliceRow, ent.alice);
    renderRow(entEls.bobRow, ent.bob);
    util.setText(entEls.alicePct, 'Alice\u2019s share of 1s: ' + shareText(ent.alice));
    util.setText(entEls.bobPct, 'Bob\u2019s share of 1s: ' + shareText(ent.bob));
  }

  function shareText(bits) {
    if (!bits) return '\u2014';
    var ones = 0;
    for (var i = 0; i < bits.length; i++) if (bits[i] === 1) ones++;
    return Math.round((ones / bits.length) * 100) + '%';
  }

  function renderRow(host, bits) {
    host.textContent = '';
    if (!bits) return;
    bits.forEach(function (bit) {
      var sq = document.createElement('span');
      sq.className = 'ent-bit bit-' + bit;
      sq.textContent = String(bit);
      host.appendChild(sq);
    });
  }

  function compareNotes() {
    if (!ent.alice) return;
    var matches = 0;
    for (var i = 0; i < 20; i++) {
      if (ent.alice[i] === ent.bob[i]) matches++;
    }
    ent.compared = true;

    // highlight matching columns with a green outline
    highlightMatches(matches);

    entEls.summary.textContent = '';
    entEls.summary.hidden = false;
    var p1 = document.createElement('p');
    p1.textContent = 'Matches: ' + matches + ' of 20';
    var p2 = document.createElement('p');
    p2.textContent = ent.setting === 'z'
      ? 'Perfectly correlated \u2014 but only visible once the lists were compared.'
      : 'No pattern \u2014 the results are independent.';
    var p3 = document.createElement('p');
    p3.textContent = "Bob's row looked random either way. No message got through faster than light.";
    entEls.summary.appendChild(p1);
    entEls.summary.appendChild(p2);
    entEls.summary.appendChild(p3);
  }

  function highlightMatches() {
    var aliceSquares = entEls.aliceRow.children;
    var bobSquares = entEls.bobRow.children;
    for (var i = 0; i < 20; i++) {
      var match = ent.alice[i] === ent.bob[i];
      aliceSquares[i].classList.toggle('is-match', match);
      bobSquares[i].classList.toggle('is-match', match);
    }
  }

  /* ================================================================== *
   * Init
   * ================================================================== */

  IPI.limit = {
    init: function () {
      /* --- A: energy wall --- */
      wallEls.slider = document.getElementById('wall-slider');
      wallEls.speed = document.getElementById('wall-speed');
      wallEls.gap = document.getElementById('wall-gap');
      wallEls.gamma = document.getElementById('wall-gamma');
      wallEls.energy = document.getElementById('wall-energy');
      wallEls.energySub = document.getElementById('wall-energy-sub');
      wallEls.compare = document.getElementById('wall-compare');
      wallEls.trip = document.getElementById('wall-trip');
      wallEls.marker = document.getElementById('wall-marker');

      wallEls.slider.addEventListener('input', updateWall);
      updateWall();

      /* --- B: causality stepper --- */
      causalEls.svg = document.getElementById('causal-svg');
      causalEls.dots = [];
      causalEls.dotsHost = document.getElementById('causal-dots');
      causalEls.counter = document.getElementById('causal-counter');
      causalEls.title = document.getElementById('causal-step-title');
      causalEls.text = document.getElementById('causal-step-text');
      causalEls.prev = document.getElementById('causal-prev');
      causalEls.next = document.getElementById('causal-next');
      causalEls.stepper = document.getElementById('causal-stepper');

      for (var i = 0; i < 5; i++) {
        var dot = document.createElement('span');
        dot.className = 'causal-dot';
        causalEls.dotsHost.appendChild(dot);
        causalEls.dots.push(dot);
      }

      causalEls.prev.addEventListener('click', function () {
        setStep(causal.step - 1);
      });
      causalEls.next.addEventListener('click', function () {
        if (causal.step === 5) setStep(1);
        else setStep(causal.step + 1);
      });
      causalEls.stepper.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (causal.step < 5) setStep(causal.step + 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (causal.step > 1) setStep(causal.step - 1);
        }
      });

      setStep(1);

      /* --- C: entanglement demo --- */
      entEls.setting = document.getElementById('ent-setting');
      entEls.run = document.getElementById('ent-run');
      entEls.compare = document.getElementById('ent-compare');
      entEls.aliceRow = document.getElementById('ent-alice-row');
      entEls.bobRow = document.getElementById('ent-bob-row');
      entEls.alicePct = document.getElementById('ent-alice-pct');
      entEls.bobPct = document.getElementById('ent-bob-pct');
      entEls.summary = document.getElementById('ent-summary');

      entSeg = IPI.ui.createSegmented(
        entEls.setting,
        [
          { id: 'z', label: 'Alice measures with: Setting Z' },
          { id: 'x', label: 'Setting X' }
        ],
        function (id) {
          ent.setting = id;
        },
        'z'
      );

      entEls.run.addEventListener('click', runPairs);
      entEls.compare.addEventListener('click', compareNotes);

      /* --- D: accordions are native <details>, nothing to do --- */
    }
  };
})();
