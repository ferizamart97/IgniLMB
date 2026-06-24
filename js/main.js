/*
  Site bootstrap.
  The app is rendered only after the standings API has answered. No mock data is
  used; failures are surfaced in the UI.
*/
(function (window, document) {
  'use strict';

  const api = window.LMBApi;
  const ui = window.LMBUi;

  let dataReady = null;
  let appStarted = false;

  function exposeInlineHandlers() {
    window.doLogin = showApp;
    window.setAT = ui.setAT;
    window.showFgt = ui.showFgt;
    window.hideFgt = ui.hideFgt;
    window.applyF = ui.applyF;
    window.setS = ui.setS;
    window.openDr = ui.openDr;
    window.closeDr = ui.closeDr;
  }

  async function loadStandings() {
    const standings = await api.fetchStandings();
    ui.setStandings(standings);
    ui.renderShell();
    renderInteractiveSections();
    return standings;
  }

  function markLoaderDone() {
    document.getElementById('loader')?.classList.add('done');
  }

  function renderInteractiveSections() {
    ui.triggerHero();
    ui.triggerReveal();
    ui.buildMarquee();
    ui.renderAll();
    ui.buildTop5();
    ui.initKpiCounter();
    ui.showToast();
    window.setTimeout(() => ui.launchConfetti(50), 600);
  }

  async function showApp() {
    if (appStarted) return;

    appStarted = true;
    document.getElementById('ls')?.classList.add('gone');
    document.getElementById('app')?.classList.add('show');
    markLoaderDone();

    window.setTimeout(() => {
      ui.triggerHero();
      ui.triggerReveal();
    }, 120);
  }

  function bindGlobalEvents() {
    window.addEventListener('scroll', () => {
      ui.triggerReveal();
      ui.setNavbarState();
    }, { passive: true });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') ui.closeDr();
    });
  }

  function init() {
    exposeInlineHandlers();
    bindGlobalEvents();
    ui.renderLoadingState();

    dataReady = loadStandings().catch(error => {
      console.error('[LMB] No se pudieron cargar las posiciones.', error);
      ui.renderError(error);
      return null;
    });

    showApp();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window, document);
