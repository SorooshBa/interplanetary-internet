/*
 * quiz.js — Section 8.8: quiz.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;

  var QUESTIONS = [
    {
      q: 'On average, how long does light (and radio) take to travel from Earth to the Moon?',
      options: ['0.13 seconds', '1.28 seconds', '12.8 seconds', '2.5 minutes'],
      answer: 1,
      explanation: '384,400 km ÷ 299,792 km/s ≈ 1.28 s. A round trip is about 2.56 s — the gap you hear in Apollo recordings.'
    },
    {
      q: 'Why does the one-way delay to Mars change from about 3 to about 22 minutes?',
      options: [
        "Mars's thin atmosphere slows radio waves",
        'NASA changes the transmitter power over the year',
        'Signals travel slower when the Sun is nearby',
        'Earth and Mars orbit the Sun at different speeds, so the distance between them keeps changing'
      ],
      answer: 3,
      explanation: 'The distance swings from about 54.6 million km to about 401 million km. Light covers it at the same constant speed, so the delay follows the distance.'
    },
    {
      q: 'Which statement about quantum entanglement is correct?',
      options: [
        "Results are correlated, but each side's results look random on their own, so no message can be sent without an ordinary channel",
        'It lets you send messages instantly if you have enough entangled pairs',
        'It only works inside the Solar System',
        'It has been used to build faster-than-light radios'
      ],
      answer: 0,
      explanation: 'The no-communication theorem: you cannot control your partner\u2019s outcome, so you cannot encode information. The correlation only appears when both sides compare notes.'
    },
    {
      q: 'What happens to the energy needed to accelerate an object with mass as its speed approaches the speed of light?',
      options: ['It stays constant', 'It drops toward zero', 'It grows without limit', 'It grows until 99% of c, then stops'],
      answer: 2,
      explanation: 'As speed approaches c, the Lorentz factor γ grows without bound, and so does the kinetic energy (γ − 1)mc².'
    },
    {
      q: 'A web page needs about 4 round trips (DNS, TCP, TLS, HTTP). With a 25-minute round trip to Mars, roughly how long until it appears?',
      options: ['About 25 minutes', 'About 1 hour 40 minutes', 'About 12 minutes', 'About 6 hours'],
      answer: 1,
      explanation: '4 × 25 min ≈ 100 min. DTN-style single request bundles cut this to one round trip, and caching can cut it to almost nothing.'
    },
    {
      q: 'What does DTN stand for?',
      options: ['Direct Transmission Network', 'Digital Telemetry Node', 'Delay/Disruption-Tolerant Networking', 'Deep-space Transit Node'],
      answer: 2,
      explanation: 'DTN is designed for links with long delays and frequent interruptions.'
    },
    {
      q: 'In store-and-forward networking, what does a node do when the next link is down?',
      options: [
        'Keeps the bundle in storage and forwards it when the link returns',
        'Drops it and reports an error',
        'Sends it back to the sender',
        'Splits it into smaller packets and retries every millisecond'
      ],
      answer: 0,
      explanation: "Patience is the whole point: the bundle waits in the node's storage until the next contact."
    },
    {
      q: "What did the 2011 'faster-than-light neutrino' result turn out to be?",
      options: [
        'A real violation of relativity',
        'A hoax',
        'A mistake in the definition of the meter',
        'A measurement error traced to a faulty fiber-optic connection and a clock problem'
      ],
      answer: 3,
      explanation: 'OPERA found the cause in 2012. Later measurements agreed with light speed.'
    },
    {
      q: 'Why do lasers help space communication?',
      options: [
        'They make signals travel faster than radio',
        'They carry far more data per second, but the delay stays the same',
        'They avoid solar conjunction',
        "They don't need antennas"
      ],
      answer: 1,
      explanation: 'Radio and light are both electromagnetic waves traveling at c. Lasers focus the energy better, so more bits fit in each second.'
    },
    {
      q: 'Which is the closest star to the Sun?',
      options: ['Sirius', 'Alpha Centauri A', 'Proxima Centauri', "Barnard's Star"],
      answer: 2,
      explanation: 'Proxima Centauri is 4.2465 light-years away. Alpha Centauri A and B are slightly farther, at about 4.37 light-years.'
    }
  ];

  var LETTERS = ['A', 'B', 'C', 'D'];

  var quiz = {
    index: 0,
    score: 0,
    answered: false
  };
  var els = {};

  function renderQuestion() {
    var q = QUESTIONS[quiz.index];
    quiz.answered = false;

    util.setText(els.progressLabel, 'Question ' + (quiz.index + 1) + ' of ' + QUESTIONS.length);
    els.progressBar.style.width = ((quiz.index) / QUESTIONS.length * 100).toFixed(1) + '%';
    util.setText(els.scorePill, 'Score: ' + quiz.score);
    util.setText(els.question, q.q);

    els.options.textContent = '';
    q.options.forEach(function (text, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      var letter = document.createElement('span');
      letter.className = 'quiz-letter';
      letter.textContent = LETTERS[i];
      letter.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.textContent = text;
      btn.appendChild(letter);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        answer(i, btn);
      });
      els.options.appendChild(btn);
    });

    els.explanation.hidden = true;
    els.explanation.textContent = '';
    els.actions.hidden = true;
    util.setText(els.next, quiz.index === QUESTIONS.length - 1 ? 'See results' : 'Next question');
    els.results.hidden = true;
  }

  function answer(choice, btn) {
    if (quiz.answered) return;
    quiz.answered = true;

    var q = QUESTIONS[quiz.index];
    var buttons = els.options.querySelectorAll('.quiz-option');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = true;
      if (i === q.answer) buttons[i].classList.add('is-correct');
      if (i === choice && choice !== q.answer) buttons[i].classList.add('is-wrong');
    }

    if (choice === q.answer) quiz.score += 1;
    util.setText(els.scorePill, 'Score: ' + quiz.score);

    util.setText(els.explanation, q.explanation);
    els.explanation.hidden = false;
    els.actions.hidden = false;
    els.next.focus();
  }

  function next() {
    if (quiz.index < QUESTIONS.length - 1) {
      quiz.index += 1;
      renderQuestion();
    } else {
      showResults();
    }
  }

  function showResults() {
    els.progressBar.style.width = '100%';
    util.setText(els.progressLabel, 'Question ' + QUESTIONS.length + ' of ' + QUESTIONS.length);
    els.question.hidden = true;
    els.options.hidden = true;
    els.explanation.hidden = true;
    els.actions.hidden = true;
    els.results.hidden = false;

    util.setText(els.finalScore, quiz.score + ' / ' + QUESTIONS.length);

    var title;
    var text;
    if (quiz.score >= 9) {
      title = 'Mission specialist';
      text = 'You could run the Deep Space Network.';
    } else if (quiz.score >= 6) {
      title = 'Flight engineer';
      text = 'Solid. A couple of delays still caught you out.';
    } else if (quiz.score >= 3) {
      title = 'Cadet';
      text = 'Good start. Scroll back up and try the simulator again.';
    } else {
      title = 'Ground crew';
      text = 'Every expert started here. Try again!';
    }
    util.setText(els.ratingTitle, title);
    util.setText(els.ratingText, text);
  }

  function restart() {
    quiz.index = 0;
    quiz.score = 0;
    quiz.answered = false;
    els.question.hidden = false;
    els.options.hidden = false;
    renderQuestion();
  }

  IPI.quiz = {
    init: function () {
      els.progressLabel = document.getElementById('quiz-progress-label');
      els.progressBar = document.getElementById('quiz-progress-bar');
      els.scorePill = document.getElementById('quiz-score-pill');
      els.question = document.getElementById('quiz-question');
      els.options = document.getElementById('quiz-options');
      els.explanation = document.getElementById('quiz-explanation');
      els.actions = document.getElementById('quiz-actions');
      els.next = document.getElementById('quiz-next');
      els.results = document.getElementById('quiz-results');
      els.finalScore = document.getElementById('quiz-final-score');
      els.ratingTitle = document.getElementById('quiz-rating-title');
      els.ratingText = document.getElementById('quiz-rating-text');
      els.restart = document.getElementById('quiz-restart');

      els.next.addEventListener('click', next);
      els.restart.addEventListener('click', restart);

      renderQuestion();
    }
  };
})();
