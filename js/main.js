/*
 * main.js — navigation, scroll progress, scroll-spy, reveal-on-scroll,
 * page-level chrome (hero ticker, glossary, footer) and the init order.
 */
(function () {
  'use strict';

  var IPI = window.IPI;
  var util = IPI.util;
  var fmt = IPI.fmt;

  /* ------------------------------ Hero ticker ------------------------------ */

  function initHero() {
    var c = IPI.CONST.C_KM_S;
    util.setText(document.getElementById('hero-val-moon'), fmt.duration(384400 / c));
    util.setText(document.getElementById('hero-val-mars'), fmt.duration(225000000 / c));
    util.setText(
      document.getElementById('hero-val-proxima'),
      fmt.duration(4.2465 * IPI.CONST.YEAR_S)
    );
  }

  /* ------------------------------ Nav progress ----------------------------- */

  var progressEl;
  var progressQueued = false;

  function updateProgress() {
    progressQueued = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var frac = max > 0 ? util.clamp(window.scrollY / max, 0, 1) : 0;
    progressEl.style.width = frac * 100 + '%';
  }

  function onScroll() {
    if (progressQueued) return;
    progressQueued = true;
    window.requestAnimationFrame(updateProgress);
  }

  /* ------------------------------- Scroll spy ------------------------------ */

  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
    var map = {};
    var sections = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) {
        map[id] = a;
        sections.push(sec);
      }
    });

    function setActive(id) {
      links.forEach(function (a) {
        var active = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    if (typeof IntersectionObserver === 'undefined') return;
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach(function (sec) {
      obs.observe(sec);
    });
  }

  /* ---------------------------- Reveal on scroll --------------------------- */

  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (util.reducedMotion() || typeof IntersectionObserver === 'undefined') {
      els.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach(function (el) {
      obs.observe(el);
    });
  }

  /* --------------------------- Glossary + footer --------------------------- */

  function initGlossary() {
    var dl = document.getElementById('glossary-dl');
    if (!dl) return;
    IPI.GLOSSARY.forEach(function (entry) {
      var dt = document.createElement('dt');
      dt.textContent = entry.term;
      var dd = document.createElement('dd');
      dd.textContent = entry.def;
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
  }

  function initFooterLinks() {
    var ul = document.getElementById('footer-links');
    if (!ul) return;
    IPI.FURTHER_READING.forEach(function (item) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  /* --------------------------------- Init ---------------------------------- */

  document.addEventListener('DOMContentLoaded', function () {
    initHero();

    if (IPI.starfield) IPI.starfield.init();
    if (IPI.simulator) IPI.simulator.init();
    if (IPI.chat) IPI.chat.init();
    if (IPI.light) IPI.light.init();
    if (IPI.limit) IPI.limit.init();
    if (IPI.dtn) IPI.dtn.init();
    if (IPI.quiz) IPI.quiz.init();

    progressEl = document.getElementById('nav-progress');
    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();
    initScrollSpy();
    initReveal();
    initGlossary();
    initFooterLinks();

    IPI.ticker.start();
  });
})();
