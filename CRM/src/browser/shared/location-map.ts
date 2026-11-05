import type * as Leaflet from 'leaflet';
import { coordinates, coordinatesFromLink, coordinatesLink, isShortMapsLink, type Coordinates } from './location-coordinates.js';
import { requestJson } from './http.js';

declare global { interface Window { L?: typeof Leaflet } }

export function initializeLocationMaps() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-location-picker]')) initialize(root);
}
function initialize(root: HTMLElement) {
  const input = document.getElementById(root.dataset.locationInput ?? '');
  if (!(input instanceof HTMLInputElement)) return;
  const field = input;
  const readonly = root.dataset.locationReadonly === 'true';
  const container = root.querySelector<HTMLElement>('[data-location-map]')!;
  const status = root.querySelector<HTMLElement>('[data-location-status]')!;
  const latitude = root.querySelector<HTMLInputElement>('[data-location-lat]');
  const longitude = root.querySelector<HTMLInputElement>('[data-location-lng]');
  const current = root.querySelector<HTMLButtonElement>('[data-location-current]');
  const clear = root.querySelector<HTMLButtonElement>('[data-location-clear]');
  const options = root.querySelector<HTMLDetailsElement>('[data-location-options]');
  const resolveButton = root.querySelector<HTMLButtonElement>('[data-location-resolve]')!;
  const resolveLabel = resolveButton.textContent;
  const open = document.getElementById(field.id + '-open');
  const modal = root.closest('.modal');
  let map: Leaflet.Map | undefined;
  let marker: Leaflet.Marker | undefined;
  let selected: Coordinates | null = null;
  let draft = false;
  let revision = 0;
  let baseline = field.value;
  let leaving = false;
  let resolution: AbortController | undefined;
  let resolveTimer: ReturnType<typeof setTimeout> | undefined;
  let failedLink = '';

  function cancelResolution() {
    if (resolveTimer !== undefined) clearTimeout(resolveTimer);
    resolveTimer = undefined;
    resolution?.abort();
    resolution = undefined;
    resolveButton.disabled = false;
    resolveButton.textContent = resolveLabel;
  }
  async function resolveLink() {
    const link = field.value.trim();
    if (!isShortMapsLink(link) || resolution) return;
    if (resolveTimer !== undefined) clearTimeout(resolveTimer);
    resolveTimer = undefined;
    const controller = new AbortController();
    resolution = controller;
    const requestedRevision = revision;
    resolveButton.disabled = true;
    resolveButton.classList.add('d-none');
    root.dataset.locationState = 'loading';
    status.textContent = 'Buscando la ubicación del enlace…';
    try {
      const result = await requestJson<{ success: boolean; data: Coordinates & { normalizedUrl: string } }>('/tickets/resolver_ubicacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }), signal: controller.signal,
      });
      if (requestedRevision !== revision || link !== field.value.trim()) return;
      failedLink = '';
      if (readonly) {
        selected = coordinates(result.data.lat, result.data.lng);
        if (!selected) throw new Error('El enlace no devolvió coordenadas válidas.');
        container.hidden = false;
        startMap();
        renderMarker();
        root.dataset.locationState = 'ready';
        status.textContent = `Ubicación lista · ${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`;
        resolveButton.classList.add('d-none');
      } else {
        choose(result.data);
      }
    } catch (error) {
      if (controller.signal.aborted || requestedRevision !== revision) return;
      failedLink = link;
      root.dataset.locationState = 'error';
      resolveButton.classList.remove('d-none');
      status.textContent = `${error instanceof Error ? error.message : 'No se pudo convertir el enlace.'} Puedes conservarlo sin convertir o seleccionar el punto manualmente.`;
    } finally {
      if (resolution === controller) { resolution = undefined; resolveButton.disabled = false; resolveButton.textContent = resolveLabel; }
    }
  }

  function externalLink() {
    if (!(open instanceof HTMLAnchorElement)) return;
    try {
      const url = new URL(field.value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      open.href = url.href;
      open.classList.remove('disabled');
      open.removeAttribute('aria-disabled');
    } catch {
      open.removeAttribute('href');
      open.classList.add('disabled');
      open.setAttribute('aria-disabled', 'true');
    }
  }
  function renderMarker() {
    if (!map || !window.L) return;
    if (!selected) { marker?.remove(); marker = undefined; return; }
    if (marker) marker.setLatLng(selected);
    else {
      marker = window.L.marker(selected, { draggable: !readonly, title: 'Ubicación del servicio', alt: 'Ubicación del servicio' }).addTo(map);
      if (!readonly) marker.on('dragend', () => { const point = marker?.getLatLng(); if (point) choose(point); });
    }
    map.setView(selected, 16);
  }
  function choose(point: Coordinates) {
    const normalized = coordinates(point.lat, ((point.lng + 180) % 360 + 360) % 360 - 180);
    if (!normalized) return;
    field.value = coordinatesLink(normalized);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function sync() {
    revision++;
    cancelResolution();
    draft = false;
    field.setCustomValidity('');
    selected = coordinatesFromLink(field.value.trim());
    const shortLink = isShortMapsLink(field.value.trim());
    if (failedLink !== field.value.trim()) failedLink = '';
    resolveButton.classList.toggle('d-none', Boolean(selected) || !shortLink || failedLink !== field.value.trim());
    if (latitude) latitude.value = selected ? selected.lat.toFixed(6) : '';
    if (longitude) longitude.value = selected ? selected.lng.toFixed(6) : '';
    container.hidden = readonly && !selected;
    const hasLink = field.value.trim() && field.value.trim() !== 'Pendiente';
    clear?.classList.toggle('d-none', !hasLink);
    root.dataset.locationState = selected ? 'ready' : 'pending';
    status.textContent = selected
      ? `Ubicación lista · ${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`
      : hasLink
        ? 'Este enlace no identifica un punto preciso. Puedes conservarlo o seleccionar la ubicación en el mapa.'
        : readonly ? 'Ubicación pendiente.' : 'Sin punto seleccionado. Pega un enlace o elige la ubicación en el mapa.';
    renderMarker();
    externalLink();
    if (shortLink) {
      status.textContent = 'Buscando la ubicación del enlace…';
      if (!readonly && (!modal || modal.classList.contains('show')))
        resolveTimer = setTimeout(() => { void resolveLink(); }, 500);
    }
  }
  function startMap() {
    if (map || container.hidden) return;
    const L = window.L;
    if (!L) { status.textContent = 'No se pudo cargar el visor. Puedes capturar las coordenadas o conservar el enlace.'; return; }
    map = L.map(container, { scrollWheelZoom: false }).setView([23.6345, -102.5528], 5);
    const tiles = L.tileLayer(root.dataset.tileUrl!, { maxZoom: 19, attribution: root.dataset.tileAttribution! }).addTo(map);
    tiles.on('tileerror', () => root.querySelector<HTMLElement>('[data-location-tile-error]')!.classList.remove('d-none'));
    if (!readonly) map.on('click', (event: Leaflet.LeafletMouseEvent) => choose(event.latlng));
    renderMarker();
  }
  function applyCoordinates(): boolean {
    const point = coordinates(latitude?.value ?? null, longitude?.value ?? null);
    if (!point) {
      if (options) options.open = true;
      status.textContent = 'Captura una latitud entre -90 y 90 y una longitud entre -180 y 180.';
      field.setCustomValidity('Revisa ambas coordenadas antes de guardar.');
      return false;
    }
    choose(point);
    return true;
  }
  field.addEventListener('input', sync);
  sync();
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      startMap();
      if (readonly && !selected && !failedLink && isShortMapsLink(field.value.trim())) void resolveLink();
    }
  });
  observer.observe(root);
  new ResizeObserver(() => map?.invalidateSize()).observe(container);
  resolveButton.addEventListener('click', () => { void resolveLink(); });
  modal?.addEventListener('shown.bs.modal', () => { startMap(); map?.invalidateSize(); if (isShortMapsLink(field.value.trim())) void resolveLink(); });
  if (readonly) return;
  for (const coordinate of [latitude, longitude]) coordinate?.addEventListener('input', () => {
    draft = true;
    revision++;
    cancelResolution();
    field.setCustomValidity('');
    clear?.classList.remove('d-none');
    root.dataset.locationState = 'pending';
    status.textContent = 'Coordenadas modificadas. Aplica el punto al mapa o guarda el ticket.';
  });
  root.addEventListener('invalid', () => { if (options) options.open = true; }, true);
  root.querySelector('[data-location-apply]')?.addEventListener('click', applyCoordinates);
  clear?.addEventListener('click', () => {
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  current?.addEventListener('click', () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      status.textContent = 'La ubicación del dispositivo requiere HTTPS o localhost. Puedes seleccionar el punto manualmente.';
      return;
    }
    revision++;
    cancelResolution();
    const requestedRevision = revision;
    current.disabled = true;
    root.dataset.locationState = 'loading';
    status.textContent = 'Solicitando la ubicación del dispositivo…';
    navigator.geolocation.getCurrentPosition(position => {
      current.disabled = false;
      if (requestedRevision !== revision) return;
      const point = coordinates(position.coords.latitude, position.coords.longitude);
      if (point) choose(point);
    }, error => {
      current.disabled = false;
      if (requestedRevision !== revision) return;
      root.dataset.locationState = 'error';
      status.textContent = error.code === 1 ? 'No se autorizó el acceso a tu ubicación. Puedes seleccionar el punto manualmente.' : 'No fue posible obtener tu ubicación. Puedes seleccionar el punto manualmente.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  field.form?.addEventListener('submit', event => {
    if (event.defaultPrevented) return;
    if (draft && !applyCoordinates()) { event.preventDefault(); field.reportValidity(); return; }
    if (resolution || (isShortMapsLink(field.value.trim()) && failedLink !== field.value.trim())) {
      event.preventDefault();
      if (!resolution) void resolveLink();
      status.textContent = 'Espera a que termine la conversión del enlace y vuelve a guardar. Si falla, podrás conservar el enlace original.';
      return;
    }
    if (selected && !/^https?:\/\//i.test(field.value)) field.value = coordinatesLink(selected);
    if (field.value.trim() && field.value.trim() !== 'Pendiente') {
      try {
        const url = new URL(field.value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        event.preventDefault();
        field.setCustomValidity('Pega un enlace HTTP/HTTPS válido o selecciona un punto en el mapa.');
        field.reportValidity();
        return;
      }
    }
    if (!event.defaultPrevented) leaving = true;
  });
  modal?.addEventListener('show.bs.modal', () => { baseline = field.value; });
  modal?.addEventListener('hide.bs.modal', event => {
    if ((draft || field.value !== baseline) && !window.confirm('Hay cambios de ubicación sin guardar. ¿Deseas descartarlos?')) {
      event.preventDefault(); return;
    }
    field.value = baseline;
    sync();
    cancelResolution();
  });
  window.addEventListener('beforeunload', event => {
    if (!leaving && (draft || field.value !== baseline)) { event.preventDefault(); event.returnValue = ''; }
  });
}
