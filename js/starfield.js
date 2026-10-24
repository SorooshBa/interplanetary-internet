/*
 * starfield.js — decorative background canvas (Section 6.6).
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;

  var canvas, ctx, W, H, dpr;
  var stars = [];
  var t = 0;
  var shooting = null; // { x, y, angle, age }
  var nextShootIn = 12;
  var shootTimer = 0;
  var resizeTimer = null;

  var COLORS = ['#FFFFFF', '#BFD7FF', '#FFE8C2'];

  function pickColor() {
    var r = Math.random();
    if (r < 0.7) return COLORS[0];
    if (r < 0.9) return COLORS[1];
    return COLORS[2];
  }

  function buildStars() {
    var count = util.clamp(Math.round((W * H) / 4500), 120, 420);
    stars = [];
    for (var i = 0; i < count; i++) {
      var layer;
      var frac = i / count;
      if (frac < 0.6) layer = 1;
      else if (frac < 0.9) layer = 2;
      else layer = 3;
      var radius, alpha, drift;
      if (layer === 1) {
        radius = 0.5;
        alpha = 0.35 + Math.random() * 0.25;
        drift = 2;
      } else if (layer === 2) {
        radius = 0.9;
        alpha = 0.5 + Math.random() * 0.3;
        drift = 4;
      } else {
        radius = 1.3;
        alpha = 0.7 + Math.random() * 0.3;
        drift = 7;
      }
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: radius,
        a: alpha,
        drift: drift,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        color: pickColor()
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function update(dtReal) {
    if (document.hidden) return;
    t += dtReal;
    if (util.reducedMotion()) {
      drawStatic();
      return;
    }

    // drift
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x -= s.drift * dtReal;
      if (s.x < -2) s.x = W + 2;
    }

    // shooting star scheduling
    shootTimer += dtReal;
    if (!shooting && shootTimer >= nextShootIn) {
      shooting = {
        x: Math.random() * W * 0.7 + W * 0.15,
        y: -60,
        age: 0,
        vx: 90 + Math.random() * 60,
        vy: 130 + Math.random() * 50
      };
      shootTimer = 0;
      nextShootIn = 12 + Math.random() * 13;
    }

    ctx.clearRect(0, 0, W, H);

    for (var j = 0; j < stars.length; j++) {
      var st = stars[j];
      var twinkle = 0.75 + 0.25 * Math.sin(t * st.speed + st.phase);
      ctx.globalAlpha = st.a * twinkle;
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (shooting) {
      shooting.age += dtReal;
      var p = shooting.age / 0.9;
      if (p >= 1) {
        shooting = null;
      } else {
        var x = shooting.x + shooting.vx * shooting.age;
        var y = shooting.y + shooting.vy * shooting.age;
        var alpha = 0.8 * (1 - p);
        var grad = ctx.createLinearGradient(x, y, x - 120, y - 120 * (shooting.vy / shooting.vx));
        grad.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 120, y - 120 * (shooting.vy / shooting.vx));
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  IPI.starfield = {
    init: function () {
      canvas = document.getElementById('starfield');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
      });
      IPI.ticker.add(update);
    }
  };
})();
