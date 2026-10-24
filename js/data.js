/*
 * data.js — every data table and long text used by the widgets
 * (Section 5 of the build specification).
 */
(function () {
  'use strict';

  var IPI = (window.IPI = window.IPI || {});

  /* ------------------------------------------------------------------ *
   * 4.2 Destinations
   * ------------------------------------------------------------------ */

  IPI.DEST = {
    moon: {
      id: 'moon',
      name: 'Moon',
      tabSub: '1.28 s',
      host: 'moon.example',
      distanceKm: 384400,
      sizeRel: 0.27,
      contactKey: 'moon'
    },
    mars: {
      id: 'mars',
      name: 'Mars',
      tabSub: '3–22 min',
      host: 'mars.example',
      marsKm: { min: 54600000, avg: 225000000, max: 401000000 },
      sizeRel: 0.53,
      contactKey: 'mars'
    },
    proxima: {
      id: 'proxima',
      name: 'Proxima Centauri',
      tabSub: '4.25 yr',
      host: 'proxima-b.example',
      distanceKm: 4.2465 * 9460730472580.8,
      sizeRel: 0.9,
      contactKey: 'proxima'
    }
  };
  IPI.DEST_ORDER = ['moon', 'mars', 'proxima'];

  /** Mars slider parameter t (0…1) → distance in km (Section 4.2). */
  IPI.marsDistanceKm = function (t) {
    return 54600000 + t * (401000000 - 54600000);
  };
  /** t value that gives exactly 225,000,000 km ("Average"). */
  IPI.MARS_T_AVG = (225000000 - 54600000) / (401000000 - 54600000); // 0.49191…

  /* ------------------------------------------------------------------ *
   * 5.1 Traveller table
   * ------------------------------------------------------------------ */

  IPI.TRAVELLERS = [
    { id: 'light', name: 'Light / radio waves (vacuum)', speedKmS: 299792.458, color: '#5CE1E6' },
    { id: 'fiber', name: 'Light in optical fiber', speedKmS: 299792.458 / 1.4682, color: '#9B8CFF' },
    { id: 'coax', name: 'Electrical signal in coax cable', speedKmS: 299792.458 * 0.66, color: '#FFB84D' },
    { id: 'parker', name: 'Parker Solar Probe (record speed)', speedKmS: 192, color: '#FF6B6B' },
    { id: 'voyager', name: 'Voyager 1', speedKmS: 17, color: '#E8845A' },
    { id: 'jet', name: 'Commercial jet (900 km/h)', speedKmS: 0.25, color: '#A9B4C8' }
  ];

  /* ------------------------------------------------------------------ *
   * 5.2 Destination fact cards
   * ------------------------------------------------------------------ */

  IPI.FACTS = {
    moon: [
      {
        title: 'Distance',
        text: "On average 384,400 km. The Moon's orbit is slightly oval, so the distance varies between about 356,500 km and 406,700 km — and the one-way delay between 1.19 s and 1.36 s."
      },
      {
        title: 'Talking to Apollo',
        text: 'Apollo astronauts and Mission Control lived with this lag: every question needed at least 2.6 seconds for the answer to come back. You can hear the pauses in the old recordings.'
      },
      {
        title: 'Lasers from the Moon',
        text: "In 2013, NASA's LLCD experiment sent data from lunar orbit to Earth by laser at 622 Mbps — faster than many home connections today. The delay stayed the same: 1.28 seconds."
      },
      {
        title: 'Remote control (barely) works',
        text: 'Of our three destinations, the Moon is the only one where you can steer a robot by hand. With a 2.6-second round trip you must drive slowly and carefully.'
      }
    ],
    mars: [
      {
        title: 'A moving target',
        text: 'Earth and Mars orbit the Sun at different speeds, so the distance between them swings from about 54.6 million km to about 401 million km. The one-way delay swings from 3 min 2 s to 22 min 18 s.'
      },
      {
        title: 'Seven minutes of terror',
        text: 'When Curiosity landed in August 2012, the descent took about seven minutes. The radio signal needed 13 min 48 s to reach Earth. By the time controllers learned the rover had begun its descent, it was already on the ground — safe or not.'
      },
      {
        title: 'Rovers think for themselves',
        text: 'A joystick command would take 25 minutes to get an answer, so rovers receive a plan for the day and carry it out on their own, using onboard cameras and software to avoid hazards.'
      },
      {
        title: 'Solar conjunction',
        text: "About every 26 months Mars passes behind the Sun from Earth's point of view. Radio signals that pass close to the Sun get scrambled, and for about two weeks missions stop sending commands."
      },
      {
        title: 'Relay orbiters',
        text: 'Rovers mostly talk to orbiters passing overhead (short UHF radio contacts of about ten minutes), and the orbiters relay the data to Earth. Mars already has a two-hop network.'
      }
    ],
    proxima: [
      {
        title: 'Nearest neighbor',
        text: 'Proxima Centauri is the closest star to the Sun: 4.2465 light-years, about 40.17 trillion km away. It is a small red dwarf in the Alpha Centauri system (the other two stars there, A and B, are about 4.37 light-years away).'
      },
      {
        title: 'A planet next door',
        text: "Proxima b, discovered in 2016, is a planet of roughly Earth's mass orbiting in the star's habitable zone. A year there lasts only 11.2 Earth days."
      },
      {
        title: 'The trip is the problem',
        text: "Even at the record speed of NASA's Parker Solar Probe (192 km/s), the journey would take thousands of years. See the comparison table above."
      },
      {
        title: 'The Starshot idea',
        text: 'Breakthrough Starshot proposes pushing tiny light-sail probes with powerful lasers to about 20% of light speed. The trip would take about 21 years — and the first photos would need 4.2 more years to come home.'
      },
      {
        title: 'A conversation takes a lifetime',
        text: 'Ten question-and-answer exchanges would take about 85 years.'
      },
      {
        title: 'Flare star',
        text: 'Proxima is a flare star: it occasionally brightens suddenly, which affects whether a planet could keep its atmosphere.'
      }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 5.3 "What would a conversation feel like?"
   * ------------------------------------------------------------------ */

  IPI.CONVERSATION_TEXT = {
    moon: 'A voice call works, but with a noticeable gap: you ask a question and wait about 2.6 seconds for the answer. Apollo astronauts and Mission Control talked this way.',
    mars: 'A voice call is impossible. Messaging works like slow email: you send a full thought, then wait about 25 minutes for a reply (12 min 31 s each way, on average).',
    proxima: 'Think letters, not chat. Ask a question today and the answer arrives in about 8.5 years. Ten exchanges would take about 85 years.'
  };

  /* ------------------------------------------------------------------ *
   * 5.4 Chat personas and reply rules
   * ------------------------------------------------------------------ */

  IPI.PERSONAS = {
    moon: {
      name: 'Dr. Amara Okafor',
      role: 'Selene Station · lunar south pole',
      initials: 'AO',
      color: '#9AA5B8',
      place: 'the Moon',
      first: 'Amara',
      rules: [
        { re: /\b(hi|hello|hey|hola)\b/i, text: 'Hey! Loud and clear. Your message took {owd} to get here, so we can talk almost like walkie-talkies.' },
        { re: /weather|temperature|cold|hot/i, text: 'There is no weather here — no air! The surface swings from about −170 °C at night to about +120 °C in the day. Bring a jacket. A big one.' },
        { re: /last message|did you get|receive/i, text: 'Yes, received! It arrived {owd} after you sent it. Your delivery receipt needs another {owd} to get back to you.' },
        { re: /dinner|eat|food|lunch|hungry/i, text: "Rehydrated pasta again. The 'fresh' tomato is a photo taped to the wall." },
        { re: /miss|love|home/i, text: "Miss you too. Earth hangs in our sky and never moves. It's a reminder you're only {owd} away." },
        { re: /ping|latency|delay|lag/i, text: "Round trip to Earth is about {rtt}. Not bad! For Mars it's minutes, and for the nearest star it's years." },
        { re: /thank/i, text: 'Anytime!' }
      ],
      fallback: [
        'Copy that. Say again if you need to — it only costs us {rtt}.',
        'Interesting! Tell me more.',
        'Roger. Over.',
        "Got it. We'll keep you posted."
      ]
    },
    mars: {
      name: 'Cmdr. Lena Park',
      role: 'Jezero Base · Mars',
      initials: 'LP',
      color: '#E8845A',
      place: 'Mars',
      first: 'Lena',
      rules: [
        { re: /\b(hi|hello|hey|hola)\b/i, text: "Hi from Mars! Your hello took {owd} to reach us. My reply takes another {owd} to get back, so you'll hear from me about {rtt} after you sent yours." },
        { re: /weather|temperature|cold|hot/i, text: "Dusty and cold. Average surface temperature is around −63 °C, the air is thin carbon dioxide, and there's a dust devil outside the window." },
        { re: /last message|did you get|receive/i, text: "Got it — it arrived {owd} after you sent it. You only learn that {rtt} after sending. That's life here." },
        { re: /dinner|eat|food|lunch|hungry/i, text: "Rehydrated chili and potatoes from the greenhouse module. We're very proud of the potatoes." },
        { re: /miss|love|home/i, text: "Miss you too. The hardest part isn't the distance — it's that every 'how are you?' takes {rtt} to answer." },
        { re: /ping|latency|delay|lag/i, text: "Right now the delay is {owd} one way, {rtt} round trip. At closest approach it drops to about 3 minutes; on the far side of the Sun it's over 22. And during solar conjunction we lose contact for about two weeks." },
        { re: /thank/i, text: 'Anytime!' }
      ],
      fallback: [
        "Message received. I'll reply properly as soon as I finish today's checklist.",
        'Copy. Tip: send full questions in one go — every back-and-forth costs {rtt}.',
        "Noted. Anything else, send it as a batch — we're not short on patience, just on time.",
        'Understood. Over.'
      ]
    },
    proxima: {
      name: 'Kai Moreno',
      role: 'Tau Landing · Proxima b (fictional colony)',
      initials: 'KM',
      color: '#FF7A59',
      place: 'Proxima b',
      first: 'Kai',
      rules: [
        { re: /\b(hi|hello|hey|hola)\b/i, text: "Hello, Earth! Your message crossed 4.2 light-years to reach us. I'll reply, but you won't read it until {rtt} after you wrote yours." },
        { re: /weather|temperature|cold|hot/i, text: 'Proxima is a flare star. Some days the sky lights up with a flare and we shelter underground. The light here is always red, never blue.' },
        { re: /last message|did you get|receive/i, text: "We have it. It arrived {owd} after you sent it. If you sent several, we're reading them in order — each one from a different moment of your life." },
        { re: /dinner|eat|food|lunch|hungry/i, text: "Algae noodles. Grown here, eaten here. At least there's no shipping delay." },
        { re: /miss|love|home/i, text: 'Everyone here is {owd} of light from home. We send letters, not chats. Yours means a lot.' },
        { re: /ping|latency|delay|lag/i, text: "Our conversation runs at {rtt} per round. We've stopped saying 'quick question'." },
        { re: /thank/i, text: 'Anytime!' }
      ],
      fallback: [
        "A letter from Earth! We'll write back properly.",
        "Noted. We'll reply in our next letter — see you in {rtt}.",
        'Message received. The answer will reach you in {owd}.',
        'Understood. Over.'
      ]
    }
  };

  /** Quick-message chips (identical for all destinations). */
  IPI.QUICK_MESSAGES = [
    'Hi! Can you hear me?',
    "What's the weather like there?",
    'Did you get my last message?',
    'What are you having for dinner?',
    'Miss you!'
  ];

  /**
   * Choose the reply text for a user message at a destination.
   * Rules are tested in order; first match wins; otherwise the next item
   * of that destination's fallback list is used (cycled by fallbackIdx).
   */
  IPI.chooseReply = function (destId, text, owd, fallbackIdx) {
    var p = IPI.PERSONAS[destId];
    var template = null;
    for (var i = 0; i < p.rules.length; i++) {
      if (p.rules[i].re.test(text)) {
        template = p.rules[i].text;
        break;
      }
    }
    var usedFallback = false;
    if (template === null) {
      template = p.fallback[fallbackIdx % p.fallback.length];
      usedFallback = true;
    }
    var out = template.replace(/\{owd\}/g, IPI.fmt.duration(owd)).replace(/\{rtt\}/g, IPI.fmt.duration(2 * owd));
    return { text: out, usedFallback: usedFallback };
  };

  /* ------------------------------------------------------------------ *
   * 5.5 Latency ladder rows
   * ------------------------------------------------------------------ */

  IPI.LADDER = [
    { id: 'room', label: 'Across a room', km: 0.003, note: '3 meters' },
    { id: 'london-ny', label: 'London → New York', km: 5570, note: 'Great-circle distance' },
    { id: 'earth-eq', label: 'Around the Earth', km: 40075, note: 'Along the equator' },
    { id: 'geo', label: 'Up to a geostationary satellite', km: 35786, note: 'A ground-satellite-ground hop doubles it' },
    { id: 'moon', label: 'The Moon', km: 384400, note: 'Average distance' },
    { id: 'sun', label: 'The Sun', km: 149597870.7, note: '1 astronomical unit' },
    { id: 'mars-close', label: 'Mars (closest)', km: 54600000, note: '' },
    { id: 'mars-avg', label: 'Mars (average)', km: 225000000, note: '' },
    { id: 'mars-far', label: 'Mars (farthest)', km: 401000000, note: 'Sun in the way' },
    { id: 'jupiter', label: 'Jupiter (about)', km: 778500000, note: 'Average distance' },
    { id: 'saturn', label: 'Saturn (about)', km: 1434000000, note: 'Average distance' },
    { id: 'neptune', label: 'Neptune (about)', km: 4500000000, note: 'Average distance' },
    { id: 'voyager', label: 'Voyager 1', km: 25500000000, note: 'Late 2026, approximate' },
    { id: 'proxima', label: 'Proxima Centauri', ly: 4.2465, note: 'Nearest star after the Sun' },
    { id: 'sirius', label: 'Sirius', ly: 8.611, note: 'Brightest star in the night sky' },
    { id: 'galactic-center', label: 'Center of the Milky Way', ly: 26000, note: '' },
    { id: 'andromeda', label: 'Andromeda Galaxy', ly: 2500000, note: 'Nearest large galaxy' }
  ];

  /** Seconds of one-way light time for a ladder row. */
  IPI.ladderSeconds = function (row) {
    if (row.ly != null) return row.ly * 31557600;
    return row.km / 299792.458;
  };

  /** Distance text for a ladder row. */
  IPI.ladderDistanceText = function (row) {
    if (row.ly != null) {
      if (row.ly < 10) return IPI.fmt.trimDecimals(row.ly, 4) + ' light-years';
      return Math.round(row.ly).toLocaleString('en-US') + ' light-years';
    }
    return IPI.fmt.distanceKm(row.km);
  };

  /** Category chip by round trip (Section 5.5). */
  IPI.ladderCategory = function (rtt) {
    if (rtt < 0.3) return { text: 'Natural voice call', color: '#4ADE80' };
    if (rtt < 10) return { text: 'Walkie-talkie', color: '#A3E635' };
    if (rtt < 3600) return { text: 'Slow messaging', color: '#FFB84D' };
    if (rtt < 604800) return { text: 'Email-style', color: '#FF9F5A' };
    return { text: 'Letters', color: '#FF6B6B' };
  };

  /** Log bar width fraction for one-way seconds. */
  IPI.ladderBarFraction = function (seconds) {
    return IPI.util.clamp((Math.log10(seconds) + 8) / 22, 0.02, 1);
  };

  /* ------------------------------------------------------------------ *
   * 5.6 Glossary
   * ------------------------------------------------------------------ */

  IPI.GLOSSARY = [
    { term: 'Bandwidth', def: 'How many bits per second a link can carry.' },
    { term: 'Bundle', def: 'A self-contained message in delay-tolerant networking. It carries everything a node needs to store and forward it.' },
    { term: 'Bundle Protocol (BP)', def: 'The main DTN protocol. Version 7 is described in RFC 9171.' },
    { term: 'CCSDS', def: 'The Consultative Committee for Space Data Systems, the international body that writes standards for space communication.' },
    { term: 'Contact window', def: 'A period when two nodes can talk, for example when an orbiter is above a rover.' },
    { term: 'Deep Space Network (DSN)', def: "NASA's network of giant antennas at Goldstone, Madrid and Canberra used to talk to distant spacecraft." },
    { term: 'DNS', def: 'The system that turns names such as example.com into network addresses.' },
    { term: 'DTN', def: 'Delay/Disruption-Tolerant Networking: protocols designed for long delays and links that come and go.' },
    { term: 'Latency', def: 'The time it takes for data to get from one place to another.' },
    { term: 'Light-second, light-year', def: 'The distance light travels in one second (299,792 km) or in one year (about 9.46 trillion km).' },
    { term: 'Lorentz factor (γ)', def: 'A number that tells how much time slows down and energy grows for something moving at a given fraction of light speed. It is 1 at rest and grows without limit as speed approaches c.' },
    { term: 'LTP', def: 'Licklider Transmission Protocol: reliable transfer over one long-delay link, described in RFC 5326.' },
    { term: 'One-way delay (OWD)', def: 'Latency in one direction. In space it is essentially the light travel time.' },
    { term: 'Packet', def: 'A small chunk of data sent across a network.' },
    { term: 'Ping', def: 'A test that sends a small message and measures how long the reply takes.' },
    { term: 'Round-trip time (RTT)', def: 'The time for a message to reach its destination and for the reply to return.' },
    { term: 'Solar conjunction', def: 'When the Sun lies between Earth and another planet, blocking or scrambling radio signals.' },
    { term: 'Store-and-forward', def: 'Holding a message in storage until the next link is available, then sending it on.' },
    { term: 'TCP', def: 'The protocol that gives most of the internet reliable connections. It needs several back-and-forth messages to start.' },
    { term: 'TLS', def: 'The encryption layer used by HTTPS. It adds another back-and-forth exchange.' }
  ];

  /* ------------------------------------------------------------------ *
   * 5.7 Further reading
   * ------------------------------------------------------------------ */

  IPI.FURTHER_READING = [
    { label: 'RFC 9171 — Bundle Protocol Version 7', href: 'https://www.rfc-editor.org/rfc/rfc9171' },
    { label: 'RFC 5326 — Licklider Transmission Protocol', href: 'https://www.rfc-editor.org/rfc/rfc5326' },
    { label: 'NASA Deep Space Network', href: 'https://deepspace.jpl.nasa.gov' },
    { label: 'NASA', href: 'https://www.nasa.gov' },
    { label: 'CCSDS — space data standards', href: 'https://public.ccsds.org' },
    { label: 'Interplanetary Networking Special Interest Group', href: 'https://www.ipnsig.org' },
    { label: 'European Southern Observatory — Proxima b', href: 'https://www.eso.org' }
  ];
})();
