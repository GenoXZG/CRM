(() => {
  const assistant = document.getElementById('crmSetupAssistant');
  if (!assistant) return;

  const STORAGE = {
    skipped: 'crmSetupSkippedStepsV1',
    dismissed: 'crmSetupAssistantDismissedV1',
    ticketCreated: 'crmSetupTicketCreatedV1',
    ticketDeferred: 'crmSetupTicketDeferredV1',
    baseline: 'crmSetupBaselineV1',
  };
  const safeRead = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value; }
    catch { return fallback; }
  };
  const readSkipped = () => {
    try { const value = JSON.parse(safeRead(STORAGE.skipped, '[]')); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const writeSkipped = (values) => {
    try { localStorage.setItem(STORAGE.skipped, JSON.stringify([...new Set(values)])); } catch {}
  };
  const readBaseline = () => {
    try { const value = JSON.parse(safeRead(STORAGE.baseline, '{}')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  };
  // Un paso cuenta como completado en la base solo si hay más registros que los que existían al reiniciar la guía.
  const isInDatabase = (item) => {
    const count = Number(item.dataset.setupCount ?? (item.dataset.setupDone === 'true' ? 1 : 0));
    return count > Number(readBaseline()[item.dataset.setupItem] || 0);
  };
  const hasTicketCreated = () => safeRead(STORAGE.ticketCreated, '0') === '1';
  const isDismissed = () => safeRead(STORAGE.dismissed, '0') === '1';
  const ticketCreatedParam = new URLSearchParams(window.location.search).get('setupTicketCreated');
  if (ticketCreatedParam === '1') {
    try { localStorage.setItem(STORAGE.ticketCreated, '1'); localStorage.removeItem(STORAGE.ticketDeferred); } catch {}
    const url = new URL(window.location.href); url.searchParams.delete('setupTicketCreated'); url.searchParams.delete('setupReturn');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }
  const returnParam = new URLSearchParams(window.location.search).get('setupReturn');
  if (returnParam) {
    const url = new URL(window.location.href); url.searchParams.delete('setupReturn');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  const reopenCard = document.getElementById('crmSetupReopen');
  const closeButton = document.getElementById('setupClose');
  const reopenButton = document.getElementById('setupReopen');
  const skipAllButton = document.getElementById('setupSkipAll');
  const progressText = document.getElementById('setupProgressText');
  const progressCaption = document.getElementById('setupProgressCaption');
  const progressBar = document.getElementById('setupProgressBar');
  const progressFill = document.getElementById('setupProgressFill');
  const completedBanner = document.getElementById('setupCompletedBanner');
  const catalogGroup = assistant.querySelector('[data-setup-group="catalogs"]');

  function update() {
    const skipped = readSkipped();
    let progress = 0;
    let completeActions = 0;
    const allItems = [...assistant.querySelectorAll('[data-setup-item]')];
    for (const item of allItems) {
      const key = item.dataset.setupItem;
      const weight = Number(item.dataset.setupWeight || 0);
      const isTicket = key === 'ticket';
      const existsInDatabase = !isTicket && isInDatabase(item);
      const isDone = isTicket ? hasTicketCreated() : existsInDatabase;
      const isSkipped = !isTicket && skipped.includes(key);
      const isCompleteForProgress = isDone || isSkipped;
      if (isCompleteForProgress) { progress += weight; completeActions += 1; }
      item.classList.toggle('is-done', isDone);
      item.classList.toggle('is-skipped', !isDone && isSkipped);
      const state = item.querySelector('[data-setup-state]');
      if (state) {
        if (isDone) state.textContent = isTicket ? 'Ticket creado' : 'Completado';
        else if (isSkipped) state.textContent = 'Omitido';
        else state.textContent = 'Por hacer';
      }
      const skipButton = item.querySelector(`[data-skip-step="${key}"]`);
      if (skipButton) {
        skipButton.textContent = isSkipped ? 'Restaurar paso' : 'Omitir';
        skipButton.disabled = isDone;
      }
    }
    if (catalogGroup) {
      const catalogItems = [...catalogGroup.querySelectorAll('[data-setup-item]')];
      const finished = catalogItems.filter((item) => isInDatabase(item) || skipped.includes(item.dataset.setupItem));
      const groupState = catalogGroup.querySelector(':scope > .setup-step-main [data-setup-state]');
      if (groupState) groupState.textContent = `${finished.length} de 3`;
      catalogGroup.classList.toggle('is-done', finished.length === 3 && catalogItems.every((item) => isInDatabase(item)));
      catalogGroup.classList.toggle('is-skipped', finished.length === 3 && !catalogItems.every((item) => isInDatabase(item)));
      const skipCatalogButton = assistant.querySelector('[data-skip-catalogs]');
      if (skipCatalogButton) skipCatalogButton.textContent = catalogItems.every((item) => skipped.includes(item.dataset.setupItem)) ? 'Restaurar los tres catálogos' : 'Omitir los tres catálogos';
    }
    progress = Math.min(100, progress);
    if (progressText) progressText.textContent = `${progress}%`;
    if (progressCaption) progressCaption.textContent = `${completeActions} de 6 acciones con progreso completado`;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(progress));
    if (completedBanner) completedBanner.classList.toggle('d-none', !hasTicketCreated());
    const skipAll = assistant.querySelector('#setupSkipAll');
    if (skipAll) skipAll.innerHTML = 'Omitir todos e ir a crear un ticket <i class="bi bi-arrow-right"></i>';
  }

  assistant.querySelectorAll('[data-skip-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.skipStep; if (!key) return;
      const item = assistant.querySelector(`[data-setup-item="${key}"]`);
      if (item && isInDatabase(item)) return;
      const skipped = readSkipped();
      writeSkipped(skipped.includes(key) ? skipped.filter((value) => value !== key) : [...skipped, key]);
      update();
    });
  });

  const skipCatalogs = assistant.querySelector('[data-skip-catalogs]');
  if (skipCatalogs) skipCatalogs.addEventListener('click', () => {
    const keys = ['equipment', 'units', 'accessories'];
    const skipped = readSkipped();
    const allSkipped = keys.every((key) => skipped.includes(key));
    writeSkipped(allSkipped ? skipped.filter((key) => !keys.includes(key)) : [...skipped, ...keys]);
    update();
  });

  if (skipAllButton) skipAllButton.addEventListener('click', () => {
    writeSkipped([...readSkipped(), 'clients', 'technicians', 'equipment', 'units', 'accessories']);
    update();
    window.location.href = '/tickets/nuevo?setup=ticket';
  });

  function showAssistant(show) {
    assistant.classList.toggle('d-none', !show);
    if (reopenCard) reopenCard.classList.toggle('d-none', show);
    try { localStorage.setItem(STORAGE.dismissed, show ? '0' : '1'); } catch {}
  }
  if (closeButton) closeButton.addEventListener('click', () => showAssistant(false));
  if (reopenButton) reopenButton.addEventListener('click', () => showAssistant(true));

  const resetButton = document.getElementById('setupReset');
  if (resetButton) resetButton.addEventListener('click', () => {
    const baseline = {};
    assistant.querySelectorAll('[data-setup-item]').forEach((item) => {
      if (item.dataset.setupItem !== 'ticket') baseline[item.dataset.setupItem] = Number(item.dataset.setupCount || 0);
    });
    try {
      localStorage.setItem(STORAGE.baseline, JSON.stringify(baseline));
      localStorage.removeItem(STORAGE.skipped);
      localStorage.removeItem(STORAGE.ticketCreated);
      localStorage.removeItem(STORAGE.ticketDeferred);
    } catch {}
    showAssistant(true);
    update();
  });

  showAssistant(!isDismissed());
  update();
})();
