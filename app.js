// ==========================================
// 1. CONFIGURAÇÕES GERAIS E VARIÁVEIS 
// ==========================================
const ZOOM_MIN_RANGE = 1000 * 60 * 60 * 24 * 7;       // 1 semana
const ZOOM_MAX_RANGE = 1000 * 60 * 60 * 24 * 365 * 2; // 2 anos

let componentZoom = { geral: 1, detalhamento: 1 };
let currentPage = 'geral';

let timelines = { geral: null, detalhamento: null };
let allParsedData = { geral: null, detalhamento: null, avaliacoes: null };

// --- VARIÁVEIS DE AVALIAÇÕES ---
const LINKS_AVALIACOES = [
  {
    nome: "CRM - Ops",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTLgWt2KoG47RZD1FvW4EMMFg8XXfAKWts_LXN2XZu0ibP_GpsaN1OU6un_UQ1bVg2ER5_ihYyoev-R/pub?gid=1591400573&single=true&output=csv" 
  },
  {
    nome: "Growth - Ops",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTLgWt2KoG47RZD1FvW4EMMFg8XXfAKWts_LXN2XZu0ibP_GpsaN1OU6un_UQ1bVg2ER5_ihYyoev-R/pub?gid=1524287528&single=true&output=csv" 
  }
];

let availableAbas = new Set();
let availableMeses = new Set(); 
let chartInstances = { nps: null };
let chartInstancesSat = {}; 

// --- VARIÁVEIS DO ROADMAP ---
let availableStacks = { geral: new Set(), detalhamento: new Set() };
let availableResponsaveis = { detalhamento: new Set() };
let availableStatuses = { detalhamento: new Set() };

let itemLinkMap = { geral: new Map(), detalhamento: new Map() };
let clickHandlerBound = { geral: false, detalhamento: false };

let todayTimer = { geral: null, detalhamento: null };
const TODAYID = 'today';


// ==========================================
// 2. NAVEGAÇÃO E UI GERAL
// ==========================================
function switchPage(page) {
  currentPage = page;
  document.getElementById('page-geral').style.display = page === 'geral' ? 'block' : 'none';
  document.getElementById('page-detalhamento').style.display = page === 'detalhamento' ? 'block' : 'none';
  document.getElementById('page-avaliacoes').style.display = page === 'avaliacoes' ? 'block' : 'none';

  document.getElementById('link-geral').classList.toggle('is-active', page === 'geral');
  document.getElementById('link-detalhamento').classList.toggle('is-active', page === 'detalhamento');
  document.getElementById('link-avaliacoes').classList.toggle('is-active', page === 'avaliacoes');

  // RESOLUÇÃO DOS TÍTULOS: Seleção blindada para qualquer versão do HTML
  const mainTitle = document.querySelector('h1');
  const mainSubtitle = document.querySelector('.subtitle');
  
  if (page === 'geral') {
    if (mainTitle) mainTitle.textContent = 'Roadmap - Geral';
    if (mainSubtitle) mainSubtitle.textContent = 'Conecte sua planilha do Google Sheets e visualize seu roadmap interativo';
  } else if (page === 'detalhamento') {
    if (mainTitle) mainTitle.textContent = 'Roadmap - Detalhamento';
    if (mainSubtitle) mainSubtitle.textContent = 'Acompanhe os cards detalhados por projeto, responsável e status';
  } else if (page === 'avaliacoes') {
    if (mainTitle) mainTitle.textContent = 'Índices de satisfação - Caaqui';
    if (mainSubtitle) mainSubtitle.textContent = 'Acompanhe os resultados de NPS e pesquisas de satisfação das áreas';
  }

  setTimeout(() => {
    if (page === 'geral' && timelines.geral) { timelines.geral.redraw(); ensureTodayMarker('geral'); }
    if (page === 'detalhamento' && timelines.detalhamento) { timelines.detalhamento.redraw(); ensureTodayMarker('detalhamento'); }
  }, 50);
}

function showStatus(type, message, pageKey) {
  const suffix = pageKey === 'geral' ? '' : '-detalhes';
  const statusDiv = document.getElementById('status-message' + suffix);
  if (!statusDiv) return;
  const iconMap = { loading: '<div class="spinner"></div>', success: '✓', error: '⚠' };
  statusDiv.innerHTML = `<div class="status-indicator status-${type}">${iconMap[type]}<span>${message}</span></div>`;
}

function clearStatus(pageKey) {
  const suffix = pageKey === 'geral' ? '' : '-detalhes';
  const statusDiv = document.getElementById('status-message' + suffix);
  if (statusDiv) statusDiv.innerHTML = '';
}

function openItemLink(url) {
  const u = String(url || '').trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) return;
  window.open(u, '_blank', 'noopener,noreferrer');
}

function formatTodayTitle(now) {
  const d = now.toLocaleDateString('pt-BR');
  return `Hoje (${d})`;
}

function applyTodayStylingAndTooltip(titleText, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let el = container.querySelector('.vis-custom-time[data-id="' + TODAYID + '"]') || container.querySelector('.vis-custom-time[data-custom-time="' + TODAYID + '"]');
  if (!el) {
    const all = container.querySelectorAll('.vis-custom-time');
    if (all && all.length > 0) el = all[all.length - 1];
  }
  if (el) { el.classList.add('today'); el.setAttribute('title', titleText); }

  const marker = container.querySelector('.vis-custom-time.today .vis-custom-time-marker');
  if (marker) marker.setAttribute('title', titleText);
}

function ensureTodayMarker(pageKey) {
  if (!timelines[pageKey]) return;
  const now = new Date();
  const titleText = formatTodayTitle(now);

  try {
    timelines[pageKey].getCustomTime(TODAYID);
    timelines[pageKey].setCustomTime(now, TODAYID);
    timelines[pageKey].setCustomTimeMarker('HOJE', TODAYID, false);
    timelines[pageKey].setCustomTimeTitle(titleText, TODAYID);
  } catch (e) {
    timelines[pageKey].addCustomTime(now, TODAYID);
    timelines[pageKey].setCustomTimeMarker('HOJE', TODAYID, false);
    timelines[pageKey].setCustomTimeTitle(titleText, TODAYID);
  }
  const containerId = pageKey === 'geral' ? 'visualization' : 'visualization-detalhes';
  setTimeout(() => applyTodayStylingAndTooltip(titleText, containerId), 0);
}

function startTodayMarkerClock(pageKey) {
  if (todayTimer[pageKey]) clearInterval(todayTimer[pageKey]);
  ensureTodayMarker(pageKey);
  todayTimer[pageKey] = setInterval(() => ensureTodayMarker(pageKey), 60 * 1000);
}


// ==========================================
// 3. UTILITÁRIOS E PARSERS
// ==========================================
function extractBracketText(text) {
  const s = String(text || '').trim();
  const m = s.match(/\[(.*?)\]/);
  return m ? m[1].trim() : s;
}

function getCardsModeDetalhamento() {
  const el = document.getElementById('cards-mode-toggle-detalhes');
  return (el && el.checked) ? 'updated' : 'outdated';
}

function updateCardsModeLabel() {
  const el = document.getElementById('cards-mode-toggle-detalhes');
  const label = document.getElementById('cards-mode-text');
  const wrap = document.getElementById('cards-mode-toggle-wrap');
  if (!el || !label) return;
  label.textContent = el.checked ? 'Cards atualizados' : 'Cards desatualizados';
  if (wrap) wrap.querySelector('.cards-switch')?.setAttribute('title', el.checked ? 'Alternar para cards desatualizados' : 'Alternar para cards atualizados');
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.options).filter(o => o.selected).map(o => o.value);
}

function formatSelectedLabel(selectEl) {
  const values = getSelectedValues(selectEl).filter(v => v !== 'all');
  if (!values.length) return 'Todos';
  if (values.length <= 2) return values.join(', ');
  return values.slice(0, 2).join(', ') + ` +${values.length - 2}`;
}

function splitPeople(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  return s.replace(/\n/g, ',').replace(/\s*;\s*/g, ',').replace(/\s*\/\s*/g, ',').split(',').map(x => x.trim()).filter(Boolean);
}

function sameCI(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function normalizeList(list) {
  return (Array.isArray(list) ? list : []).map(v => String(v || '').trim()).filter(Boolean).filter(v => v !== 'all');
}

function getGroupingModeGeral() {
  const el = document.getElementById('grouping-toggle-geral');
  return (el && el.checked) ? 'stack' : 'geral';
}

function updateGroupingModeLabel() {
  const el = document.getElementById('grouping-toggle-geral');
  const label = document.getElementById('grouping-mode-text');
  const groupForm = document.getElementById('stack-filter-group-geral');
  if (!el || !label) return;

  const mode = el.checked ? 'stack' : 'geral';
  label.textContent = (mode === 'stack') ? 'Por stack' : 'Geral';
  if (groupForm) groupForm.style.display = (mode === 'stack') ? '' : 'none';
  if (mode !== 'stack') {
    const sel = document.getElementById('stack-filter');
    if (sel) sel.value = 'all';
  }
}

function parseCSV(csvText) {
  const result = Papa.parse(String(csvText || '').trim(), { header: true, skipEmptyLines: true });
  return result.data || [];
}

function parseBRDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') {
    const d = new Date((dateValue - 25569) * 86400 * 1000);
    return isNaN(d) ? null : d;
  }
  const raw = String(dateValue).trim();
  if (!raw) return null;
  const s = raw.replace(/^"|"$/g, '').replace(/\u00A0/g, ' ').trim();

  const shortDate = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortDate) {
    let p1 = parseInt(shortDate[1], 10);
    let p2 = parseInt(shortDate[2], 10);
    let year = new Date().getFullYear(); 
    let m = p1, d = p2;
    if (p1 > 12) { d = p1; m = p2; }
    return new Date(year, m - 1, d);
  }

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?.*$/);
  if (br) {
    let dd = parseInt(br[1], 10); let mm = parseInt(br[2], 10); let yyyy = parseInt(br[3], 10);
    if (yyyy < 100) yyyy = (yyyy >= 70) ? (1900 + yyyy) : (2000 + yyyy);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d) ? null : d;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (iso) {
    const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    return isNaN(d) ? null : d;
  }
  const d2 = new Date(s);
  return isNaN(d2) ? null : d2;
}

function formatDate(date) {
  if (!date || isNaN(date)) return '-';
  return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function normalizeKeyName(name) {
  return String(name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00A0]/g, ' ').replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
}

function getCell(row, candidates) {
  if (!row) return '';
  const keys = Object.keys(row);
  const normKeys = new Map(keys.map(k => [normalizeKeyName(k), k]));

  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
    const nk = normalizeKeyName(c);
    if (normKeys.has(nk)) return row[normKeys.get(nk)];
    for (const [n, orig] of normKeys.entries()) {
      if (n === nk || n.includes(nk) || nk.includes(n)) return row[orig];
    }
  }
  return '';
}

// LUPA CSS BLINDADA: e.preventDefault() obriga o Scroll a não rolar a página enquanto usa Lupa
function updateZoomCSS(pageKey, newZoom) {
   componentZoom[pageKey] = Math.max(0.5, Math.min(2.5, newZoom));
   document.documentElement.style.setProperty('--timeline-zoom', componentZoom[pageKey]);
   if (timelines[pageKey]) timelines[pageKey].redraw(); 
}

function bindCtrlWheelZoom(container, pageKey) {
  if (!container) return;
  if (container.dataset.wheelBound) return; 
  container.dataset.wheelBound = "1";

  container.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return; 
    e.preventDefault(); 
    e.stopPropagation(); 
    
    let currentZ = componentZoom[pageKey];
    const zoomStep = 0.05; // Ajuste Fino e Macio
    if (e.deltaY < 0) currentZ += zoomStep; else currentZ -= zoomStep;
    updateZoomCSS(pageKey, currentZ);
  }, { passive: false });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao acessar planilha (${res.status}).`);
  const csvText = await res.text();
  if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
    throw new Error('O link retornou HTML em vez de CSV. Verifique a planilha.');
  }
  return parseCSV(csvText);
}


// ==========================================
// 4. LÓGICAS DO ROADMAP (GERAL E DETALHES)
// ==========================================
function parseSheetDataGeral(rows, filterStack = 'all', groupingMode = 'stack') {
  const items = []; const groups = []; const groupSet = new Set();
  availableStacks.geral.clear();

  if (groupingMode === 'geral') { groups.push({ id: 'Geral', content: 'Geral' }); groupSet.add('Geral'); }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const resumo = String(getCell(row, ['Resumo']) || '').trim();
    let dataInicio = parseBRDate(getCell(row, ['Start date']));
    const dataTarget = parseBRDate(getCell(row, ['Target end']));
    const dataFinishReal = parseBRDate(getCell(row, ['Finish Date','Finish date']));
    const status = String(getCell(row, ['Status']) || 'planejado').trim();
    const chave = String(getCell(row, ['Chave','Key','Link']) || '').trim();

    if (!resumo) continue; 

    const stacksRaw = String(getCell(row, ['Stacks','Stack']) || 'Sem Stack');
    const cleanedStacks = stacksRaw.replace(/\s*\n\s*/g, ',').replace(/\s*;\s*/g, ',').replace(/\s*\/\s*/g, ',').replace(/\s*\|\s*/g, ',');
    const stacksArray = cleanedStacks.split(',').map(s => s.trim()).filter(Boolean);
    stacksArray.forEach(st => availableStacks.geral.add(st));

    if (!dataTarget && !dataFinishReal) continue;

    if (!dataInicio) dataInicio = new Date(); 
    let dataFinalDoCard = dataFinishReal || dataTarget;
    if (dataInicio > dataFinalDoCard) { dataInicio = new Date(dataFinalDoCard); dataInicio.setDate(dataInicio.getDate() - 15); }

    let customStyle;
    if (dataTarget && dataFinalDoCard.getTime() > dataTarget.getTime()) {
      const totalDuration = dataFinalDoCard.getTime() - dataInicio.getTime();
      const targetDuration = dataTarget.getTime() - dataInicio.getTime();
      let targetPercent = totalDuration > 0 ? (targetDuration / totalDuration) * 100 : 100;
      targetPercent = Math.max(0, Math.min(100, targetPercent)); 
      customStyle = `background: linear-gradient(to right, rgba(33, 128, 141, 0.15) 0%, rgba(33, 128, 141, 0.15) ${targetPercent}%, rgba(255, 103, 31, 0.6) ${targetPercent}%, rgba(255, 103, 31, 0.6) 100%) !important; border-color: var(--color-primary) !important;`;
    } else {
      customStyle = `background-color: rgba(33, 128, 141, 0.15) !important; border-color: var(--color-primary) !important;`;
    }

    const titleMatch = resumo.match(/\[(.*?)\]/);
    const displayTitle = titleMatch ? titleMatch[1] : resumo;
    const statusNormalized = String(status || 'planejado').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const badgeStyle = `background: rgba(98,108,113,0.12); color:#13343b;`;

    const tooltipHtml = `
      <div style="font-size:0.9rem; line-height:1.5; min-width: 250px;">
        <strong style="color:var(--color-primary); font-size:1rem;">${displayTitle}</strong><br/>
        <b>Status:</b> ${status}<br/>
        <hr style="margin:6px 0; border:0; border-top:1px solid rgba(255,255,255,0.2);">
        <b>Início:</b> ${formatDate(dataInicio)}<br/>
        <b>Previsão:</b> ${formatDate(dataTarget)}<br/>
        <b>Fim Real:</b> ${formatDate(dataFinishReal)}
      </div>
    `;

    const createItemObj = (idPrefix, grupo) => ({
      id: idPrefix,
      content: `
        <div class="vis-item-content" style="display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong>${displayTitle}</strong>
            <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${badgeStyle} font-weight:800;">${status}</span>
          </div>
          <div style="font-size:0.75rem; opacity:0.85;">Start: ${formatDate(dataInicio)} | Target: ${formatDate(dataTarget)} | Finish: ${formatDate(dataFinishReal)}</div>
        </div>
      `,
      start: dataInicio, end: dataFinalDoCard, group: grupo,
      className: `status-${statusNormalized}`, style: customStyle, title: tooltipHtml, linkUrl: chave
    });

    if (groupingMode === 'geral') {
      items.push(createItemObj(`geral-${i}`, 'Geral'));
      continue;
    }

    const stacksToShow = (filterStack === 'all') ? stacksArray : stacksArray.filter(s => s === filterStack);
    stacksToShow.forEach((stack, stackIdx) => {
      if (!groupSet.has(stack)) { groupSet.add(stack); groups.push({ id: stack, content: stack }); }
      items.push(createItemObj(`geral-${i}-${stackIdx}`, stack));
    });
  }
  return { items, groups };
}

function parseSheetDataDetalhamento(rows, filterProjeto = 'all', filterResponsavel = ['all'], filterStatus = ['all'], cardsMode = 'updated') {
  const epicItems = []; 
  const childItems = []; 
  
  const allProjects = new Set();
  const epicByProject = new Map(); const projectEpicLink = new Map();
  const respFilters = normalizeList(filterResponsavel); const statusFilters = normalizeList(filterStatus);

  availableStacks.detalhamento.clear(); availableResponsaveis.detalhamento.clear(); availableStatuses.detalhamento.clear();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projetoRaw = String(getCell(row, ['Projeto']) || '').trim();
    if (!projetoRaw) continue;

    allProjects.add(projetoRaw); availableStacks.detalhamento.add(projetoRaw);

    const epicLinkCandidate = String(getCell(row, ['Epic Link','Epic','URL Epic','Link da Epic']) || '').trim();
    if (epicLinkCandidate && !projectEpicLink.has(projetoRaw)) projectEpicLink.set(projetoRaw, epicLinkCandidate);

    if (filterProjeto === 'all' || projetoRaw === filterProjeto) {
      const respRaw = String(getCell(row, ['Nome do responsável','Responsável','Assignee']) || '').trim();
      splitPeople(respRaw).forEach(p => availableResponsaveis.detalhamento.add(p));
      const st = String(getCell(row, ['Status']) || '').trim();
      if (st) availableStatuses.detalhamento.add(st);
    }

    if (!epicByProject.has(projetoRaw)) {
      let epicStart = parseBRDate(getCell(row, ['Start date (Epic)']));
      if (epicStart) {
        const epicTarget = parseBRDate(getCell(row, ['Target end (Epic)']));
        const epicFinish = parseBRDate(getCell(row, ['Finish date (Epic)']));
        let epicEnd = epicFinish || epicTarget || new Date(epicStart.getTime() + 24 * 60 * 60 * 1000);
        if (epicEnd <= epicStart) epicEnd = new Date(epicStart.getTime() + 24 * 60 * 60 * 1000);

        const totalDuration = epicEnd - epicStart;
        const targetDuration = epicTarget ? (epicTarget - epicStart) : totalDuration;
        const targetPercent = totalDuration > 0 ? (targetDuration / totalDuration) * 100 : 100;

        const green = '#34D399'; const greenBorder = '#065F46'; const orange = '#F97316';
        let epicStyle = (epicTarget && epicTarget < epicEnd) 
          ? `background: linear-gradient(to right, ${green} 0%, ${green} ${targetPercent}%, ${orange} ${targetPercent}%, ${orange} 100%) !important; border-color: ${greenBorder} !important;`
          : `background-color: ${green} !important; border-color: ${greenBorder} !important;`;
        
        epicByProject.set(projetoRaw, { start: epicStart, target: epicTarget, end: epicEnd, style: epicStyle });
      }
    }
  }

  const includedProjects = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projetoRaw = String(getCell(row, ['Projeto']) || '').trim();
    if (!projetoRaw || (filterProjeto !== 'all' && projetoRaw !== filterProjeto)) continue;

    const resumo = String(getCell(row, ['Resumo']) || '').trim();
    const childStart = parseBRDate(getCell(row, ['Start date']));
    const childTarget = parseBRDate(getCell(row, ['Target end']));
    const childFinish = parseBRDate(getCell(row, ['Finish Date']));

    if (!resumo) continue;
    const hasValidDates = childStart && (childTarget || childFinish);

    if (cardsMode === 'updated' && !hasValidDates) continue; 
    if (cardsMode === 'outdated' && hasValidDates) continue; 

    let renderStart = childStart || new Date();
    let renderEnd = childFinish || childTarget || new Date(renderStart.getTime() + 15 * 24 * 60 * 60 * 1000); 
    if (renderEnd <= renderStart) renderEnd = new Date(renderStart.getTime() + 15 * 24 * 60 * 60 * 1000);

    const responsavelRaw = String(getCell(row, ['Nome do responsável','Responsável','Assignee']) || '').trim();
    const status = String(getCell(row, ['Status']) || 'planejado').trim();
    
    const passResp = (respFilters.length === 0) ? true : splitPeople(responsavelRaw).some(p => respFilters.some(f => sameCI(p, f)));
    const passStatus = (statusFilters.length === 0) ? true : statusFilters.some(f => sameCI(status, f));
    if (!passResp || !passStatus) continue;

    includedProjects.add(projetoRaw);

    const statusNormalized = status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const targetPercent = childTarget ? Math.max(0, Math.min(100, ((childTarget - renderStart) / (renderEnd - renderStart)) * 100)) : 100;

    let style = (childTarget && renderEnd > childTarget)
      ? `background: linear-gradient(to right, rgba(33, 128, 141, 0.15) 0%, rgba(33, 128, 141, 0.15) ${targetPercent}%, rgba(255, 103, 31, 0.6) ${targetPercent}%, rgba(255, 103, 31, 0.6) 100%) !important; border-color: var(--color-primary) !important;`
      : `background-color: rgba(33, 128, 141, 0.15) !important; border-color: var(--color-primary) !important;`;

    const tooltipHtml = `
      <div style="font-size:0.9rem; line-height:1.5; min-width: 250px;">
        <strong style="color:var(--color-primary); font-size:1rem; display:block; margin-bottom:4px;">${resumo}</strong>
        <b>Projeto:</b> ${projetoRaw}<br/><b>Responsável:</b> ${responsavelRaw || 'Não atribuído'}<br/><b>Status:</b> ${status}<br/>
        <hr style="margin:6px 0; border:0; border-top:1px solid rgba(255,255,255,0.2);">
        <b>Início:</b> ${formatDate(childStart)}<br/><b>Previsão:</b> ${formatDate(childTarget)}<br/><b>Fim Real:</b> ${formatDate(childFinish)}
      </div>
    `;

    // SOLUÇÃO WATERFALL: Zero Pad para garantir que a ordem alfabética da String respeite o tempo. ID = 1_child_...
    const timestampStr = renderStart.getTime().toString().padStart(15, '0');
    const uniqueWaterfallSubgroup = '1_child_' + timestampStr + '_' + i;

    childItems.push({
      id: `child-${i}`,
      content: `
        <div class="vis-item-content" style="display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong>${resumo}</strong>
            <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background: rgba(98,108,113,0.12); color:#13343b; font-weight:800;">${status}</span>
          </div>
          <div style="font-size:0.75rem; opacity:0.85;">Start: ${formatDate(childStart)} | Target: ${formatDate(childTarget)} | Finish: ${formatDate(childFinish)}</div>
          ${responsavelRaw ? `<div style="font-size:0.75rem; opacity:0.9;">Resp.: <strong>${responsavelRaw}</strong></div>` : ''}
        </div>
      `,
      start: renderStart, end: renderEnd, group: projetoRaw, 
      subgroup: uniqueWaterfallSubgroup, 
      className: `status-${statusNormalized}`, style, title: tooltipHtml, linkUrl: projectEpicLink.get(projetoRaw)
    });
  }

  const projectsToShow = Array.from(includedProjects);
  
  // SOLUÇÃO EPIC NO TOPO MÁXIMO DEFINITIVO
  // Injetamos a Função de Ordernação dentro de cada Grupo. A biblioteca comparará os subgroup IDs.
  const groups = projectsToShow.sort().map(p => ({ 
    id: p, 
    content: extractBracketText(p),
    subgroupOrder: function (a, b) {
      // Puxa o ID do Subgrupo. O Epic tem o id "0_epic" e os Filhos "1_child...".
      // A comparação de Strings ('0' vs '1') forçará o Epic sempre para o Topo e o resto vira Waterfall.
      const valA = String(a && a.subgroup ? a.subgroup : (a.id || a));
      const valB = String(b && b.subgroup ? b.subgroup : (b.id || b));
      return valA.localeCompare(valB);
    }
  }));

  projectsToShow.forEach(p => {
    const info = epicByProject.get(p);
    if (!info) return;

    const epicTooltip = `
      <div style="font-size:0.9rem; line-height:1.5; min-width: 250px;">
        <strong style="color:var(--color-primary); font-size:1rem; display:block; margin-bottom:4px;">${p}</strong>
        <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background: rgba(255,255,255,0.2); font-weight:800; color:#fff;">EPIC</span>
        <hr style="margin:6px 0; border:0; border-top:1px solid rgba(255,255,255,0.2);">
        <b>Início:</b> ${formatDate(info.start)}<br/><b>Previsão:</b> ${formatDate(info.target)}<br/><b>Fim Real:</b> ${formatDate(info.end)}
      </div>
    `;
    const epicContent = `
      <div style="display:flex; flex-direction:row; align-items:center; gap:8px; white-space:nowrap; pointer-events:none;">
        <strong style="font-weight:900; font-size:0.95rem; color:#065F46;">${extractBracketText(p)}</strong>
        <span style="font-size:0.85rem; font-weight:400; color:#065F46;">
          Data de início: ${formatDate(info.start)} | Data fim esperada: ${formatDate(info.target)} | Data fim real: ${formatDate(info.end)}
        </span>
      </div>
    `;

    epicItems.push({
      id: `epic-${p}`, content: epicContent, start: info.start, end: info.end, group: p, 
      subgroup: '0_epic', // ID do Subgrupo com "0" para garantir o Topo absoluto.
      className: 'epic-item', style: info.style, title: epicTooltip, linkUrl: projectEpicLink.get(p)
    });
  });

  return { items: [...epicItems, ...childItems], groups };
}


// ==========================================
// 5. CRIAÇÃO DOS ROADMAPS E FILTROS
// ==========================================
function updateStackFilterGeral() {
  const select = document.getElementById('stack-filter');
  const current = select.value;
  select.innerHTML = '<option value="all">Todos</option>';
  Array.from(availableStacks.geral).sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v; select.appendChild(opt);
  });
  if (current !== 'all' && availableStacks.geral.has(current)) select.value = current;
}

function updateDetalhamentoFilters() {
  const projSelect = document.getElementById('stack-filter-detalhes');
  const currentProj = projSelect.value;
  projSelect.innerHTML = '<option value="all">Todos</option>';
  Array.from(availableStacks.detalhamento).sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = extractBracketText(v); projSelect.appendChild(opt);
  });
  if (currentProj !== 'all' && availableStacks.detalhamento.has(currentProj)) projSelect.value = currentProj;

  const respSelect = document.getElementById('responsavel-filter-detalhes');
  const currentResp = new Set(Array.from(respSelect.selectedOptions || []).map(o => o.value).filter(v => v !== 'all'));
  respSelect.innerHTML = '<option value="all">Todos</option>';
  Array.from(availableResponsaveis.detalhamento).sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (currentResp.has(v)) opt.selected = true; respSelect.appendChild(opt);
  });

  const stSelect = document.getElementById('status-filter-detalhes');
  const currentSt = new Set(Array.from(stSelect.selectedOptions || []).map(o => o.value).filter(v => v !== 'all'));
  stSelect.innerHTML = '<option value="all">Todos</option>';
  Array.from(availableStatuses.detalhamento).sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (currentSt.has(v)) opt.selected = true; stSelect.appendChild(opt);
  });

  rebuildMultiSelect('responsavel-filter-detalhes');
  rebuildMultiSelect('status-filter-detalhes');
}

function rebuildMultiSelect(selectId) {
  const selectEl = document.getElementById(selectId);
  const wrapper = document.querySelector(`.multi-select[data-select="${selectId}"]`);
  if (!selectEl || !wrapper) return;
  const trigger = wrapper.querySelector('.multi-select-trigger');
  const valueEl = wrapper.querySelector('.multi-select-value');
  const dropdown = wrapper.querySelector('.multi-select-dropdown');
  dropdown.innerHTML = '';

  Array.from(selectEl.options).forEach((opt) => {
    const row = document.createElement('div'); row.className = 'multi-select-option';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!opt.selected;
    const label = document.createElement('div'); label.textContent = opt.textContent;
    row.appendChild(cb); row.appendChild(label);
    row.addEventListener('click', (e) => {
      e.preventDefault();
      if (opt.value === 'all') { Array.from(selectEl.options).forEach(o => { o.selected = (o.value === 'all'); }); } 
      else {
        opt.selected = !opt.selected;
        const allOpt = Array.from(selectEl.options).find(o => o.value === 'all');
        if (allOpt) allOpt.selected = false;
        if (!Array.from(selectEl.options).some(o => o.value !== 'all' && o.selected) && allOpt) allOpt.selected = true;
      }
      Array.from(dropdown.querySelectorAll('.multi-select-option')).forEach((el, idx) => { el.querySelector('input').checked = !!selectEl.options[idx].selected; });
      valueEl.textContent = formatSelectedLabel(selectEl);
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    dropdown.appendChild(row);
  });
  valueEl.textContent = formatSelectedLabel(selectEl);

  if (!trigger.dataset.bound) {
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', () => { trigger.setAttribute('aria-expanded', wrapper.classList.toggle('is-open') ? 'true' : 'false'); });
  }
  if (!wrapper.dataset.outsideBound) {
    wrapper.dataset.outsideBound = '1';
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) { wrapper.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
    });
  }
}

function createTimeline(data, pageKey) {
  const containerId = pageKey === 'geral' ? 'visualization' : 'visualization-detalhes';
  const container = document.getElementById(containerId);
  itemLinkMap[pageKey] = new Map(data.items.map(it => [it.id, it.linkUrl]));
  const isDetalhes = (pageKey === 'detalhamento');

  const options = {
    width: '100%', height: '100%', orientation: 'top', stack: true, stackSubgroups: true,
    groupHeightMode: isDetalhes ? 'auto' : 'fitItems',
    groupWidth: getComputedStyle(document.documentElement).getPropertyValue('--stack-col-width').trim() || '220px',
    margin: { axis: isDetalhes ? 52 : 40, item: { horizontal: 10, vertical: isDetalhes ? 26 : 18 } },
    showCurrentTime: false, zoomMin: ZOOM_MIN_RANGE, zoomMax: ZOOM_MAX_RANGE, locale: 'pt-BR',
    
    // Zoom Nativo de Eixo Tempo Desativado (Lupa CSS vai Reinar)
    verticalScroll: true, 
    horizontalScroll: false, 
    zoomable: false, 
    
    tooltip: { followMouse: true, overflowMethod: 'cap' }
  };

  if (timelines[pageKey]) {
    timelines[pageKey].setOptions(options); 
    timelines[pageKey].setGroups(data.groups);
    timelines[pageKey].setItems(data.items);
  } else {
    timelines[pageKey] = new vis.Timeline(container, data.items, data.groups, options);
  }

  // ATIVA A LUPA CSS NOVO!
  bindCtrlWheelZoom(container, pageKey);

  if (!clickHandlerBound[pageKey]) {
    timelines[pageKey].on('click', function (props) {
      if (!props || !props.item) return;
      const link = itemLinkMap[pageKey] ? itemLinkMap[pageKey].get(props.item) : null;
      if (link) openItemLink(link);
    });
    clickHandlerBound[pageKey] = true;
  }

  startTodayMarkerClock(pageKey);
  ensureTodayMarker(pageKey);
}

function changeViewMode(pageKey) {
  const tl = timelines[pageKey];
  if (!tl) return;
  const suffix = pageKey === 'geral' ? '' : '-detalhes';
  const viewMode = document.getElementById('view-mode' + suffix).value;
  const now = new Date();
  let start, end;
  
  switch (viewMode) {
    case 'week': 
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3); 
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 11); 
      break;
    case 'month': 
      start = new Date(now.getFullYear(), now.getMonth(), -5); 
      end = new Date(now.getFullYear(), now.getMonth() + 1, 5); 
      break;
    case 'quarter': 
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
      end = new Date(now.getFullYear(), now.getMonth() + 3, 0); 
      break;
    case 'year': 
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1); 
      end = new Date(now.getFullYear(), now.getMonth() + 6, 0); 
      break;
    default: return;
  }
  
  tl.setWindow(start, end, { animation: false });
  ensureTodayMarker(pageKey);
}

function applyFilterGeral() {
  if (!allParsedData.geral) return;
  const mode = getGroupingModeGeral();
  const stack = (mode === 'stack') ? document.getElementById('stack-filter').value : 'all';
  const data = parseSheetDataGeral(allParsedData.geral, stack, mode);
  createTimeline(data, 'geral');
  updateStackFilterGeral();
  updateGroupingModeLabel();
}

function applyFilterDetalhamento() {
  if (!allParsedData.detalhamento) return;
  const proj = document.getElementById('stack-filter-detalhes').value;
  const respEl = document.getElementById('responsavel-filter-detalhes');
  const stEl = document.getElementById('status-filter-detalhes');
  const respFilters = Array.from(respEl.selectedOptions || []).map(o => o.value).length ? Array.from(respEl.selectedOptions || []).map(o => o.value) : ['all'];
  const stFilters = Array.from(stEl.selectedOptions || []).map(o => o.value).length ? Array.from(stEl.selectedOptions || []).map(o => o.value) : ['all'];
  const data = parseSheetDataDetalhamento(allParsedData.detalhamento, proj, respFilters, stFilters, getCardsModeDetalhamento());
  createTimeline(data, 'detalhamento');
  updateDetalhamentoFilters();
  updateCardsModeLabel();
}


// ==========================================
// 6. DASHBOARD DE AVALIAÇÕES (GRÁFICOS)
// ==========================================
function extractMonthYear(dateString) {
  const d = parseBRDate(dateString);
  if (!d) return null;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function wrapText(text, maxLineLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  words.forEach(w => {
    if ((currentLine + w).length > maxLineLength) { lines.push(currentLine.trim()); currentLine = w + ' '; } 
    else { currentLine += w + ' '; }
  });
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

function getColorForAverage(avg) {
  if (avg >= 4.5) return '#22c55e'; 
  if (avg >= 3.5) return '#84cc16'; 
  if (avg >= 2.5) return '#d1d5db'; 
  if (avg >= 1.5) return '#f09694'; 
  return '#d9534f'; 
}

function updateFiltersAvaliacoes() {
  const selectAba = document.getElementById('aba-filter-avaliacoes');
  const currentAba = selectAba.value;
  selectAba.innerHTML = '<option value="all">Todas as Áreas (Consolidado)</option>';
  Object.keys(allParsedData.avaliacoes).sort().forEach(nomeAba => {
    const opt = document.createElement('option'); opt.value = nomeAba; opt.textContent = nomeAba; selectAba.appendChild(opt);
  });
  if (currentAba !== 'all' && allParsedData.avaliacoes[currentAba]) selectAba.value = currentAba;

  availableMeses.clear();
  Object.values(allParsedData.avaliacoes).forEach(rows => {
    rows.forEach(row => {
      const my = extractMonthYear(getCell(row, ['Carimbo de data/hora', 'Timestamp', 'Data']));
      if (my) availableMeses.add(my);
    });
  });

  const selectMes = document.getElementById('mes-filter-avaliacoes');
  const currentMes = selectMes.value;
  selectMes.innerHTML = '<option value="all">Todo o período</option>';
  
  Array.from(availableMeses).sort((a,b) => {
    const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
    const d1 = new Date(parseInt(y1), parseInt(m1)-1);
    const d2 = new Date(parseInt(y2), parseInt(m2)-1);
    return d1 - d2; 
  }).forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v; selectMes.appendChild(opt);
  });
  if (currentMes !== 'all' && availableMeses.has(currentMes)) selectMes.value = currentMes;
}

function applyFilterAvaliacoes() {
  if (!allParsedData.avaliacoes) return;
  const aba = document.getElementById('aba-filter-avaliacoes').value;
  const mes = document.getElementById('mes-filter-avaliacoes').value;
  
  let filteredRows = [];
  Object.entries(allParsedData.avaliacoes).forEach(([nomeAba, rows]) => {
    if (aba !== 'all' && nomeAba !== aba) return; 
    rows.forEach(row => {
      if (mes !== 'all') {
        const rowMes = extractMonthYear(getCell(row, ['Carimbo de data/hora', 'Timestamp', 'Data']));
        if (rowMes !== mes) return; 
      }
      row._abaOrigin = nomeAba; 
      filteredRows.push(row);
    });
  });
  renderGraficosAvaliacoes(filteredRows);
}

function renderGraficosAvaliacoes(rows) {
  let totalRespondentes = 0;
  rows.forEach(row => {
    let isRealResponse = false;
    const npsRaw = getCell(row, ['NPS', '0 a 10', 'recomendaria', 'recomendar']);
    if (npsRaw !== undefined && npsRaw !== '') {
      const score = parseInt(npsRaw, 10);
      if (!isNaN(score) && score >= 0 && score <= 10) isRealResponse = true;
    }
    if (!isRealResponse) {
      Object.values(row).forEach(val => {
        const s = String(val).trim();
        if (/^[1-5]$/.test(s) || /^[1-5]\.[0-9]+$/.test(s) || /^[1-5],[0-9]+$/.test(s)) {
          isRealResponse = true;
        }
      });
    }
    if (isRealResponse) totalRespondentes++;
  });

  const textoRespondentes = `${totalRespondentes} respondente${totalRespondentes !== 1 ? 's' : ''}`;
  const npsBadge = document.getElementById('nps-respondentes-badge');
  if (npsBadge) npsBadge.textContent = textoRespondentes;
  const satBadge = document.getElementById('sat-respondentes-badge');
  if (satBadge) satBadge.textContent = textoRespondentes;

  let npsCounts = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0};
  let sumNps = 0; let totalNps = 0;

  rows.forEach(row => {
    const npsRaw = getCell(row, ['NPS', '0 a 10', 'recomendaria', 'recomendar']);
    if (npsRaw !== undefined && npsRaw !== '') {
      const score = parseInt(npsRaw, 10);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        npsCounts[score]++; sumNps += score; totalNps++;
      }
    }
  });

  const npsAverage = totalNps > 0 ? parseFloat((sumNps / totalNps).toFixed(1)) : '-';
  const npsTextEl = document.getElementById('nps-score-text');
  npsTextEl.textContent = npsAverage !== '-' ? npsAverage : '-';
  
  if (npsAverage !== '-') {
    if (npsAverage >= 8.5) npsTextEl.style.color = '#22c55e'; 
    else if (npsAverage >= 7.0) npsTextEl.style.color = '#84cc16'; 
    else if (npsAverage >= 5.0) npsTextEl.style.color = '#d1d5db'; 
    else npsTextEl.style.color = '#d9534f';
  }

  if (chartInstances.nps) chartInstances.nps.destroy();
  const npsLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const dataDetratores = npsLabels.map(l => parseInt(l) <= 6 ? npsCounts[l] : null);
  const dataNeutros = npsLabels.map(l => parseInt(l) >= 7 && parseInt(l) <= 8 ? npsCounts[l] : null);
  const dataPromotores = npsLabels.map(l => parseInt(l) >= 9 ? npsCounts[l] : null);

  chartInstances.nps = new Chart(document.getElementById('npsChart'), {
    type: 'bar',
    data: {
      labels: npsLabels,
      datasets: [
        { label: '😡 Detratores', data: dataDetratores, backgroundColor: '#d9534f', borderRadius: 4 },
        { label: '😐 Neutros', data: dataNeutros, backgroundColor: '#d1d5db', borderRadius: 4 },
        { label: '🤩 Promotores', data: dataPromotores, backgroundColor: '#22c55e', borderRadius: 4 }
      ]
    },
    options: {
      maintainAspectRatio: false, 
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Nota' } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Qtd de Respostas' } }
      }
    }
  });

  const satContainer = document.getElementById('sat-charts-container');
  satContainer.innerHTML = ''; 
  Object.values(chartInstancesSat).forEach(c => c.destroy()); 
  chartInstancesSat = {};

  let globalSatSum = 0;
  let globalSatCount = 0;

  if (rows.length === 0) {
    satContainer.innerHTML = '<p style="color:#626c71; text-align:center;">Nenhum dado encontrado para este filtro.</p>';
    return;
  }

  const rowsByAba = {};
  rows.forEach(r => {
    if (!rowsByAba[r._abaOrigin]) rowsByAba[r._abaOrigin] = [];
    rowsByAba[r._abaOrigin].push(r);
  });

  Object.keys(rowsByAba).sort().forEach((abaName, index) => {
    const abaRows = rowsByAba[abaName];
    if (abaRows.length === 0) return;

    const headers = Object.keys(abaRows[0]);
    
    let isRow0Questions = false;
    headers.forEach(h => {
      const val = abaRows[0][h];
      if (val && isNaN(parseFloat(val)) && String(val).trim().length > 20) {
        isRow0Questions = true;
      }
    });

    const startIndex = isRow0Questions ? 1 : 0;
    const questionMap = {};
    headers.forEach(h => {
      questionMap[h] = isRow0Questions ? String(abaRows[0][h] || '').trim() : String(h).trim();
    });

    const excludeKeywords = ['carimbo', 'timestamp', 'data', 'e-mail', 'email', 'empresa', 'nome', 'representa', 'nps', '0 a 10', 'recomend', '_abaorigin'];
    
    const validCols = [];
    
    headers.forEach(h => {
      const fullQ = questionMap[h].toLowerCase();
      if (!fullQ || fullQ.length < 5) return;
      if (excludeKeywords.some(kw => fullQ.includes(kw))) return;

      let validCount = 0;
      let invalidCount = 0;
      
      for (let i = startIndex; i < abaRows.length; i++) {
        const rawVal = String(abaRows[i][h]).trim();
        if (!rawVal) continue;
        
        if (/^[1-5]$/.test(rawVal) || /^[1-5]\.[0-9]+$/.test(rawVal) || /^[1-5],[0-9]+$/.test(rawVal)) {
            validCount++;
        } else {
            invalidCount++;
        }
      }
      
      if (validCount > 0 && invalidCount === 0) {
          validCols.push(h);
      }
    });

    if (validCols.length === 0) return; 

    const displayLabels = []; 
    const fullQuestions = []; 
    const averages = [];
    const barColors = [];
    
    let abaSatSum = 0;
    let abaSatCount = 0;

    validCols.forEach(h => {
      let qSum = 0;
      let qCount = 0;

      abaRows.slice(startIndex).forEach(r => {
        const rawVal = String(r[h]).trim();
        if (/^[1-5]$/.test(rawVal) || /^[1-5]\.[0-9]+$/.test(rawVal) || /^[1-5],[0-9]+$/.test(rawVal)) {
            const val = parseFloat(rawVal.replace(',', '.'));
            if (val >= 1 && val <= 5) {
                qSum += val;
                qCount++;
                
                abaSatSum += val;
                abaSatCount++;
                globalSatSum += val;
                globalSatCount++;
            }
        }
      });

      if (qCount > 0) {
        const avg = parseFloat((qSum / qCount).toFixed(2));
        const fullQ = questionMap[h] || h;
        
        fullQuestions.push(fullQ);
        displayLabels.push(wrapText(fullQ, 55)); 
        averages.push(avg);
        barColors.push(getColorForAverage(avg));
      }
    });

    if (displayLabels.length === 0) return;

    const abaAvgNum = abaSatCount > 0 ? parseFloat((abaSatSum / abaSatCount).toFixed(2)) : null;
    const abaAvgText = abaAvgNum ? abaAvgNum.toFixed(2) : '-';
    const abaAvgColor = abaAvgNum ? getColorForAverage(abaAvgNum) : 'var(--color-text-primary)';
    
    const canvasHeight = Math.max(180, displayLabels.length * 75 + 60);
    
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '32px';
    wrapper.innerHTML = `
      <h4 style="font-size:1.1rem; color:var(--color-text-primary); margin-bottom:16px; text-align:center; font-weight:800;">
        Formulário: ${abaName} <span style="color:${abaAvgColor}; font-size:1rem; font-weight:800; margin-left: 6px;">(Média: ${abaAvgText})</span>
      </h4>
      <div style="position: relative; width: 100%; height: ${canvasHeight}px;">
        <canvas id="satChart_${index}"></canvas>
      </div>
    `;
    satContainer.appendChild(wrapper);

    chartInstancesSat[abaName] = new Chart(document.getElementById(`satChart_${index}`), {
      type: 'bar',
      data: {
        labels: displayLabels, 
        datasets: [{ 
          label: 'Nota Média', 
          data: averages, 
          backgroundColor: barColors, 
          borderRadius: 4 
        }]
      },
      options: {
        indexAxis: 'y', 
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: { 
            callbacks: {
              title: function(tooltipItems) {
                return wrapText(fullQuestions[tooltipItems[0].dataIndex], 60);
              },
              label: function(context) {
                return ' Média de satisfação: ' + context.parsed.x;
              }
            }
          } 
        },
        scales: {
          x: { beginAtZero: true, max: 5, ticks: { stepSize: 1 }, title: { display: true, text: 'Nota Média (1 a 5)' } },
          y: { ticks: { autoSkip: false, font: { size: 12 } } }
        }
      }
    });
  });

  const globalAvg = globalSatCount > 0 ? parseFloat((globalSatSum / globalSatCount).toFixed(2)) : null;
  const globalEl = document.getElementById('satisfacao-geral-text');
  if (globalEl) {
    globalEl.textContent = globalAvg ? globalAvg.toFixed(2) : '-';
    globalEl.style.color = globalAvg ? getColorForAverage(globalAvg) : 'var(--color-text-primary)';
  }
}


// ==========================================
// 7. GERENCIADOR DE DADOS (FETCH/LOAD)
// ==========================================
async function handleLoadData(pageKey) {
  const suffix = pageKey === 'geral' ? '' : '-detalhes';
  const urlInput = document.getElementById('spreadsheet-url' + suffix);
  const url = urlInput ? urlInput.value.trim() : null;

  showStatus('loading', 'Carregando dados...', pageKey);
  try {
    if (pageKey === 'avaliacoes') {
      allParsedData.avaliacoes = {};
      for (const config of LINKS_AVALIACOES) {
        if (!config.url) continue;
        const rows = await fetchCSV(config.url);
        allParsedData.avaliacoes[config.nome] = rows;
      }
      updateFiltersAvaliacoes(); 
      applyFilterAvaliacoes();
      document.getElementById('refresh-data-avaliacoes').style.display = 'inline-flex';
    }
    else {
      if (!url) { showStatus('error', 'Configure a fonte de dados.', pageKey); return; }
      const rows = await fetchCSV(url);
      allParsedData[pageKey] = rows;

      if (pageKey === 'geral') {
        updateGroupingModeLabel();
        createTimeline(parseSheetDataGeral(rows, 'all', getGroupingModeGeral()), 'geral');
        updateStackFilterGeral();
        
        changeViewMode('geral');
      } else if (pageKey === 'detalhamento') {
        createTimeline(parseSheetDataDetalhamento(rows, 'all', 'all', 'all'), 'detalhamento');
        updateDetalhamentoFilters();
        
        changeViewMode('detalhamento');
      }
      document.getElementById('refresh-data' + suffix).style.display = 'inline-flex';
      setTimeout(() => { if (timelines[pageKey]) timelines[pageKey].redraw(); }, 80);
    }
    showStatus('success', 'Dados carregados com sucesso.', pageKey);
    setTimeout(() => clearStatus(pageKey), 2500);
  } catch (e) { showStatus('error', e.message || 'Erro ao carregar dados.', pageKey); }
}

async function handleRefreshData(pageKey) {
  if (pageKey === 'avaliacoes') { handleLoadData('avaliacoes'); return; }
  
  const suffix = pageKey === 'geral' ? '' : '-detalhes';
  const url = document.getElementById('spreadsheet-url' + suffix).value.trim();
  if (!url) return;

  showStatus('loading', 'Atualizando dados...', pageKey);
  try {
    const rows = await fetchCSV(url);
    allParsedData[pageKey] = rows;
    if (pageKey === 'geral') applyFilterGeral(); else applyFilterDetalhamento();
    showStatus('success', 'Dados atualizados com sucesso.', pageKey);
    setTimeout(() => clearStatus(pageKey), 2500);
  } catch (e) { showStatus('error', e.message || 'Erro ao atualizar dados.', pageKey); }
}


// ==========================================
// 8. MODAL E BINDINGS (SÓ EXECUTADO 1 VEZ)
// ==========================================
const modalOverlay = document.getElementById('source-modal');
const closeBtn = document.getElementById('modal-close');
const cancelBtn = document.getElementById('modal-cancel');
const saveBtn = document.getElementById('modal-save');
const sourceInput = document.getElementById('source-input');

function openModal() {
  const current = document.getElementById(currentPage === 'geral' ? 'spreadsheet-url' : 'spreadsheet-url-detalhes').value.trim();
  sourceInput.value = current; modalOverlay.classList.add('is-open'); modalOverlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => sourceInput.focus(), 0);
}

function closeModal() { modalOverlay.classList.remove('is-open'); modalOverlay.setAttribute('aria-hidden', 'true'); }
closeBtn.addEventListener('click', closeModal); cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) closeModal(); });
saveBtn.addEventListener('click', () => {
  document.getElementById(currentPage === 'geral' ? 'spreadsheet-url' : 'spreadsheet-url-detalhes').value = sourceInput.value.trim();
  closeModal(); handleLoadData(currentPage);
});
sourceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });
document.getElementById('show-example').addEventListener('click', (e) => {
  e.preventDefault(); const exampleUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1XWEct_XM9RKexp9EDzkiW-VDsoQi6fS9m2qr36J2Kkih8ivQjhnWbdgOV8cgTH8vcqzGdObzTJWt/pub?gid=591233746&single=true&output=csv';
  document.getElementById(currentPage === 'geral' ? 'spreadsheet-url' : 'spreadsheet-url-detalhes').value = exampleUrl; sourceInput.value = exampleUrl;
});

// Eventos Avaliações
document.getElementById('aba-filter-avaliacoes').addEventListener('change', applyFilterAvaliacoes);
document.getElementById('mes-filter-avaliacoes').addEventListener('change', applyFilterAvaliacoes); 
document.getElementById('load-data-avaliacoes').addEventListener('click', () => handleLoadData('avaliacoes'));
document.getElementById('refresh-data-avaliacoes').addEventListener('click', () => handleRefreshData('avaliacoes'));

// Eventos Roadmap Geral e Detalhamento
document.getElementById('stack-filter').addEventListener('change', applyFilterGeral);
const groupingToggle = document.getElementById('grouping-toggle-geral');
if (groupingToggle) groupingToggle.addEventListener('change', () => { updateGroupingModeLabel(); applyFilterGeral(); });
document.getElementById('view-mode').addEventListener('change', () => changeViewMode('geral'));

document.getElementById('stack-filter-detalhes').addEventListener('change', applyFilterDetalhamento);
document.getElementById('responsavel-filter-detalhes').addEventListener('change', applyFilterDetalhamento);
document.getElementById('status-filter-detalhes').addEventListener('change', applyFilterDetalhamento);

const cardsModeToggle = document.getElementById('cards-mode-toggle-detalhes');
if (cardsModeToggle) cardsModeToggle.addEventListener('change', () => { updateCardsModeLabel(); applyFilterDetalhamento(); });
document.getElementById('view-mode-detalhes').addEventListener('change', () => changeViewMode('detalhamento'));

// Botões de Zoom do Eixo X (Lateral)
document.getElementById('zoom-in').addEventListener('click', () => { const tl = timelines.geral; if (!tl) return; const w = tl.getWindow(); const mid = (w.start.valueOf() + w.end.valueOf()) / 2; let range = Math.max(ZOOM_MIN_RANGE, (w.end.valueOf() - w.start.valueOf()) * 0.8); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
document.getElementById('zoom-out').addEventListener('click', () => { const tl = timelines.geral; if (!tl) return; const w = tl.getWindow(); const mid = (w.start.valueOf() + w.end.valueOf()) / 2; let range = Math.min(ZOOM_MAX_RANGE, (w.end.valueOf() - w.start.valueOf()) * 1.25); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
document.getElementById('zoom-fit').addEventListener('click', () => { if (timelines.geral) timelines.geral.fit({ animation: false }); });
document.getElementById('zoom-in-detalhes').addEventListener('click', () => { const tl = timelines.detalhamento; if (!tl) return; const w = tl.getWindow(); const mid = (w.start.valueOf() + w.end.valueOf()) / 2; let range = Math.max(ZOOM_MIN_RANGE, (w.end.valueOf() - w.start.valueOf()) * 0.8); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
document.getElementById('zoom-out-detalhes').addEventListener('click', () => { const tl = timelines.detalhamento; if (!tl) return; const w = tl.getWindow(); const mid = (w.start.valueOf() + w.end.valueOf()) / 2; let range = Math.min(ZOOM_MAX_RANGE, (w.end.valueOf() - w.start.valueOf()) * 1.25); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
document.getElementById('zoom-fit-detalhes').addEventListener('click', () => { if (timelines.detalhamento) timelines.detalhamento.fit({ animation: false }); });

document.getElementById('load-data').addEventListener('click', () => handleLoadData('geral'));
document.getElementById('refresh-data').addEventListener('click', () => handleRefreshData('geral'));
document.getElementById('load-data-detalhes').addEventListener('click', () => handleLoadData('detalhamento'));
document.getElementById('refresh-data-detalhes').addEventListener('click', () => handleRefreshData('detalhamento'));

// Auto-load Inicial
window.addEventListener('DOMContentLoaded', () => {
  handleLoadData('geral');
  handleLoadData('detalhamento');
  handleLoadData('avaliacoes'); 
});
