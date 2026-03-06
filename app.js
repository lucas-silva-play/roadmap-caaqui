        // ==========================================
    // CONFIGURAÇÕES GERAIS E DECLARAÇÃO DE VARIÁVEIS 
    // ==========================================
    const ZOOM_MIN_RANGE = 1000 * 60 * 60 * 24 * 7;       // 1 semana
    const ZOOM_MAX_RANGE = 1000 * 60 * 60 * 24 * 365 * 2; // 2 anos
    
    let componentZoom = { geral: 1, detalhamento: 1 };
    let currentPage = 'geral';
    
    let timelines = { geral: null, detalhamento: null };
    let allParsedData = { geral: null, detalhamento: null };

// --- VARIÁVEIS DE AVALIAÇÕES ---
    let chartInstances = { nps: null, sat: null };
    
    // LISTA DE LINKS DAS SUAS PESQUISAS PUBLICADAS EM CSV
    const LINKS_AVALIACOES = [
      {
        nome: "CRM - Ops",
        url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTLgWt2KoG47RZD1FvW4EMMFg8XXfAKWts_LXN2XZu0ibP_GpsaN1OU6un_UQ1bVg2ER5_ihYyoev-R/pub?gid=1591400573&single=true&output=csv" // Troque pelo link real da aba CRM
      },
      {
        nome: "Growth - Ops",
        url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTLgWt2KoG47RZD1FvW4EMMFg8XXfAKWts_LXN2XZu0ibP_GpsaN1OU6un_UQ1bVg2ER5_ihYyoev-R/pub?gid=1524287528&single=true&output=csv" // Troque pelo link real da aba Growth
      }
    ];

    let availableAbas = new Set();
    let availableMeses = new Set(); // <--- NOVA 
    let chartInstances = { nps: null };
    let chartInstancesSat = {}; // <--- NOVA (guarda múltiplos gráficos)

    let availableStacks = { geral: new Set(), detalhamento: new Set() };
    let availableResponsaveis = { detalhamento: new Set() };
    let availableStatuses = { detalhamento: new Set() };

    let itemLinkMap = { geral: new Map(), detalhamento: new Map() };
    let clickHandlerBound = { geral: false, detalhamento: false };
    
    let todayTimer = { geral: null, detalhamento: null };
    const TODAYID = 'today';

function switchPage(page) {
      currentPage = page;
      // Liga/Desliga os containers
      document.getElementById('page-geral').style.display = page === 'geral' ? 'block' : 'none';
      document.getElementById('page-detalhamento').style.display = page === 'detalhamento' ? 'block' : 'none';
      document.getElementById('page-avaliacoes').style.display = page === 'avaliacoes' ? 'block' : 'none';

      // Atualiza o estado visual (cor) dos botões do menu
      document.getElementById('link-geral').classList.toggle('is-active', page === 'geral');
      document.getElementById('link-detalhamento').classList.toggle('is-active', page === 'detalhamento');
      document.getElementById('link-avaliacoes').classList.toggle('is-active', page === 'avaliacoes');

      // Redesenha os componentes se necessário
      setTimeout(() => {
        if (page === 'geral' && timelines.geral) { timelines.geral.redraw(); ensureTodayMarker('geral'); }
        if (page === 'detalhamento' && timelines.detalhamento) { timelines.detalhamento.redraw(); ensureTodayMarker('detalhamento'); }
        // No futuro, colocaremos a atualização dos gráficos aqui
      }, 50);
    }

    // --- HOJE ---
    function formatTodayTitle(now) {
      const d = now.toLocaleDateString('pt-BR');
      return `Hoje (${d})`;
    }

    function applyTodayStylingAndTooltip(titleText, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      let el = container.querySelector('.vis-custom-time[data-id="' + TODAYID + '"]') ||
               container.querySelector('.vis-custom-time[data-custom-time="' + TODAYID + '"]');

      if (!el) {
        const all = container.querySelectorAll('.vis-custom-time');
        if (all && all.length > 0) el = all[all.length - 1];
      }
      if (el) el.classList.add('today');
      if (el) el.setAttribute('title', titleText);

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

    // --- STATUS UI ---
    function showStatus(type, message, pageKey) {
      const suffix = pageKey === 'geral' ? '' : '-detalhes';
      const statusDiv = document.getElementById('status-message' + suffix);
      const iconMap = { loading: '<div class="spinner"></div>', success: '✓', error: '⚠' };
      statusDiv.innerHTML = `<div class="status-indicator status-${type}">${iconMap[type]}<span>${message}</span></div>`;
    }
    function clearStatus(pageKey) {
      const suffix = pageKey === 'geral' ? '' : '-detalhes';
      const statusDiv = document.getElementById('status-message' + suffix);
      if (statusDiv) statusDiv.innerHTML = '';
    }

    // --- LINKS ---
    function openItemLink(url) {
      const u = String(url || '').trim();
      if (!u) return;
      if (!/^https?:\/\//i.test(u)) return;
      window.open(u, '_blank', 'noopener,noreferrer');
    }

    // --- UTIL ---
    function extractBracketText(text) {
      const s = String(text || '').trim();
      const m = s.match(/\[(.*?)\]/);
      return m ? m[1].trim() : s;
    }

    function getCardsModeDetalhamento() {
      const el = document.getElementById('cards-mode-toggle-detalhes');
      if (!el) return 'updated';
      return el.checked ? 'updated' : 'outdated';
    }

    function updateCardsModeLabel() {
      const el = document.getElementById('cards-mode-toggle-detalhes');
      const label = document.getElementById('cards-mode-text');
      const wrap = document.getElementById('cards-mode-toggle-wrap');
      if (!el || !label) return;

      const updated = el.checked;
      label.textContent = updated ? 'Cards atualizados' : 'Cards desatualizados';
      if (wrap) wrap.querySelector('.cards-switch')?.setAttribute('title', updated ? 'Alternar para cards desatualizados' : 'Alternar para cards atualizados');
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

    function rebuildMultiSelect(selectId) {
      const selectEl = document.getElementById(selectId);
      const wrapper = document.querySelector(`.multi-select[data-select="${selectId}"]`);
      if (!selectEl || !wrapper) return;

      const trigger = wrapper.querySelector('.multi-select-trigger');
      const valueEl = wrapper.querySelector('.multi-select-value');
      const dropdown = wrapper.querySelector('.multi-select-dropdown');

      dropdown.innerHTML = '';

      Array.from(selectEl.options).forEach((opt) => {
        const row = document.createElement('div');
        row.className = 'multi-select-option';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!opt.selected;

        const label = document.createElement('div');
        label.textContent = opt.textContent;

        row.appendChild(cb);
        row.appendChild(label);

        row.addEventListener('click', (e) => {
          e.preventDefault();

          if (opt.value === 'all') {
            Array.from(selectEl.options).forEach(o => { o.selected = (o.value === 'all'); });
          } else {
            opt.selected = !opt.selected;
            const allOpt = Array.from(selectEl.options).find(o => o.value === 'all');
            if (allOpt) allOpt.selected = false;

            const anySelected = Array.from(selectEl.options).some(o => o.value !== 'all' && o.selected);
            if (!anySelected && allOpt) allOpt.selected = true;
          }

          Array.from(dropdown.querySelectorAll('.multi-select-option')).forEach((el, idx) => {
            const o = selectEl.options[idx];
            const c = el.querySelector('input');
            if (c) c.checked = !!o.selected;
          });

          valueEl.textContent = formatSelectedLabel(selectEl);
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });

        dropdown.appendChild(row);
      });

      valueEl.textContent = formatSelectedLabel(selectEl);

      if (!trigger.dataset.bound) {
        trigger.dataset.bound = '1';
        trigger.addEventListener('click', () => {
          const isOpen = wrapper.classList.toggle('is-open');
          trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
      }

      if (!wrapper.dataset.outsideBound) {
        wrapper.dataset.outsideBound = '1';
        document.addEventListener('click', (e) => {
          if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
          }
        });
      }
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
      if (!el) return 'stack';
      return el.checked ? 'stack' : 'geral';
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
      if (dateValue === null || dateValue === undefined || dateValue === '') return null;
      if (typeof dateValue === 'number') {
        const d = new Date((dateValue - 25569) * 86400 * 1000);
        return isNaN(d) ? null : d;
      }
      const raw = String(dateValue).trim();
      if (!raw) return null;
      const s = raw.replace(/^\"|\"$/g, '').replace(/\u00A0/g, ' ').trim();

      const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?.*$/);
      if (br) {
        let dd = parseInt(br[1], 10);
        let mm = parseInt(br[2], 10);
        let yyyy = parseInt(br[3], 10);
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

    // --- NOVA FUNÇÃO DE ZOOM ESTRUTURAL DO COMPONENTE ---
    function updateZoomCSS(pageKey, newZoom) {
       componentZoom[pageKey] = Math.max(0.5, Math.min(2.5, newZoom));
       const root = document.documentElement;
       root.style.setProperty('--timeline-zoom', componentZoom[pageKey]);
       
       if (timelines[pageKey]) {
          timelines[pageKey].redraw(); 
       }
    }

    function bindCtrlWheelZoom(container, pageKey) {
      if (!container) return;
      container.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return; 
        e.preventDefault(); 
        
        let currentZ = componentZoom[pageKey];
        const zoomStep = 0.1;
        if (e.deltaY < 0) { currentZ += zoomStep; } else { currentZ -= zoomStep; }
        
        updateZoomCSS(pageKey, currentZ);
      }, { passive: false });
    }

    async function fetchCSV(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erro ao acessar planilha (${res.status}).`);
      const csvText = await res.text();
      if (csvText.trim().startsWith('<!DOCTYPE html') || csvText.trim().startsWith('<html')) {
        throw new Error('O link retornou HTML em vez de CSV. Verifique a planilha.');
      }
      return parseCSV(csvText);
    }

    // --- PARSERS ---
    function parseSheetDataGeral(rows, filterStack = 'all', groupingMode = 'stack') {
      const items = [];
      const groups = [];
      const groupSet = new Set();

      availableStacks.geral.clear();

      if (groupingMode === 'geral') {
        groups.push({ id: 'Geral', content: 'Geral' });
        groupSet.add('Geral');
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const resumo = String(getCell(row, ['Resumo']) || '').trim();
        let dataInicio = parseBRDate(getCell(row, ['Start date']));
        const dataTarget = parseBRDate(getCell(row, ['Target end']));
        const dataFinishReal = parseBRDate(getCell(row, ['Finish Date','Finish date']));
        const status = String(getCell(row, ['Status']) || 'planejado').trim();
        const chave = String(getCell(row, ['Chave','Key','Link']) || '').trim();

        if (!resumo) continue; 

        if (!dataTarget && !dataFinishReal) {
          const stacksRaw = String(getCell(row, ['Stacks','Stack']) || 'Sem Stack');
          const cleanedStacks = stacksRaw.replace(/\s*\n\s*/g, ',').replace(/\s*;\s*/g, ',').replace(/\s*\/\s*/g, ',').replace(/\s*\|\s*/g, ',');
          const stacksArray = cleanedStacks.split(',').map(s => s.trim()).filter(Boolean);
          stacksArray.forEach(st => availableStacks.geral.add(st));
          continue; 
        }

        if (!dataInicio) { dataInicio = new Date(); }
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

        const stacksRaw = String(getCell(row, ['Stacks','Stack']) || 'Sem Stack');
        const cleanedStacks = stacksRaw.replace(/\s*\n\s*/g, ',').replace(/\s*;\s*/g, ',').replace(/\s*\/\s*/g, ',').replace(/\s*\|\s*/g, ',');
        const stacksArray = cleanedStacks.split(',').map(s => s.trim()).filter(Boolean);
        stacksArray.forEach(st => availableStacks.geral.add(st));

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
          start: dataInicio,
          end: dataFinalDoCard,
          group: grupo,
          className: `status-${statusNormalized}`,
          style: customStyle,
          title: tooltipHtml, 
          linkUrl: chave
        });

        if (groupingMode === 'geral') {
          items.push(createItemObj(`geral-${i}`, 'Geral'));
          continue;
        }

        const stacksToShow = (filterStack === 'all') ? stacksArray : stacksArray.filter(s => s === filterStack);
        if (!stacksToShow.length) continue;

        stacksToShow.forEach((stack, stackIdx) => {
          if (!groupSet.has(stack)) {
            groupSet.add(stack);
            groups.push({ id: stack, content: stack });
          }
          items.push(createItemObj(`geral-${i}-${stackIdx}`, stack));
        });
      }
      return { items, groups };
    }
    
    function parseSheetDataDetalhamento(rows, filterProjeto = 'all', filterResponsavel = ['all'], filterStatus = ['all'], cardsMode = 'updated') {
  const items = [];
  const allProjects = new Set();
  const epicByProject = new Map();
  const projectEpicLink = new Map();

  const respFilters = normalizeList(filterResponsavel);
  const statusFilters = normalizeList(filterStatus);

  availableStacks.detalhamento.clear();
  availableResponsaveis.detalhamento.clear();
  availableStatuses.detalhamento.clear();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projetoRaw = String(getCell(row, ['Projeto']) || '').trim();
    if (!projetoRaw) continue;

    allProjects.add(projetoRaw);
    availableStacks.detalhamento.add(projetoRaw);

    const epicLinkCandidate = String(getCell(row, ['Epic Link','Epic link','Epic','Link Epic','URL Epic','Epic URL','EpicLink','Link da Epic']) || '').trim();
    if (epicLinkCandidate && !projectEpicLink.has(projetoRaw)) projectEpicLink.set(projetoRaw, epicLinkCandidate);

    const considerForFacets = (filterProjeto === 'all' || projetoRaw === filterProjeto);
    if (considerForFacets) {
      const respRaw = String(getCell(row, ['Nome do responsável','Nome do responsavel','Responsável','Responsavel','Owner','Assignee','Responsavel nome']) || '').trim();
      splitPeople(respRaw).forEach(p => availableResponsaveis.detalhamento.add(p));
      const st = String(getCell(row, ['Status']) || '').trim();
      if (st) availableStatuses.detalhamento.add(st);
    }

    if (!epicByProject.has(projetoRaw)) {
      let epicStart = parseBRDate(getCell(row, ['Start date (Epic)']));
      if (epicStart) {
        const epicTarget = parseBRDate(getCell(row, ['Target end (Epic)']));
        const epicFinish = parseBRDate(getCell(row, ['Finish date (Epic)','Finish Date (Epic)']));
        let epicEnd = epicFinish || epicTarget;
        if (!epicEnd) epicEnd = new Date(epicStart.getTime() + 24 * 60 * 60 * 1000);
        if (epicEnd <= epicStart) epicEnd = new Date(epicStart.getTime() + 24 * 60 * 60 * 1000);

        const totalDuration = epicEnd - epicStart;
        const targetDuration = epicTarget ? (epicTarget - epicStart) : totalDuration;
        const targetPercent = totalDuration > 0 ? (targetDuration / totalDuration) * 100 : 100;

        const green = '#34D399'; const greenBorder = '#065F46'; const orange = '#F97316';
        let epicStyle;
        if (epicTarget && epicTarget < epicEnd) {
          epicStyle = `background: linear-gradient(to right, ${green} 0%, ${green} ${targetPercent}%, ${orange} ${targetPercent}%, ${orange} 100%) !important; border-color: ${greenBorder} !important;`;
        } else {
          epicStyle = `background-color: ${green} !important; border-color: ${greenBorder} !important;`;
        }
        epicByProject.set(projetoRaw, { start: epicStart, target: epicTarget, end: epicEnd, style: epicStyle });
      }
    }
  }

  const includedProjects = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projetoRaw = String(getCell(row, ['Projeto']) || '').trim();
    if (!projetoRaw) continue;
    if (filterProjeto !== 'all' && projetoRaw !== filterProjeto) continue;

    const resumo = String(getCell(row, ['Resumo']) || '').trim();
    const childStart = parseBRDate(getCell(row, ['Start date']));
    const childTarget = parseBRDate(getCell(row, ['Target end']));
    const childFinish = parseBRDate(getCell(row, ['Finish Date','Finish date']));

    if (!resumo) continue;

    const hasValidDates = childStart && (childTarget || childFinish);

    if (cardsMode === 'updated' && !hasValidDates) {
      continue; 
    }
    if (cardsMode === 'outdated' && hasValidDates) {
      continue; 
    }

    let renderStart = childStart || new Date();
    let renderEnd = childFinish || childTarget;
    if (!renderEnd) renderEnd = new Date(renderStart.getTime() + 15 * 24 * 60 * 60 * 1000); 
    if (renderEnd <= renderStart) renderEnd = new Date(renderStart.getTime() + 15 * 24 * 60 * 60 * 1000);

    const responsavelRaw = String(getCell(row, ['Nome do responsável','Nome do responsavel','Responsável','Responsavel','Owner','Assignee','Responsavel nome']) || '').trim();
    const responsavelList = splitPeople(responsavelRaw);
    const status = String(getCell(row, ['Status']) || 'planejado').trim();
    const epicLinkUrl = String(getCell(row, ['Epic Link','Epic link','Epic','Link Epic','URL Epic','Epic URL','EpicLink','Link da Epic']) || '').trim();

    const passResp = (respFilters.length === 0) ? true : responsavelList.some(p => respFilters.some(f => sameCI(p, f)));
    const passStatus = (statusFilters.length === 0) ? true : statusFilters.some(f => sameCI(status, f));
    if (!passResp || !passStatus) continue;

    includedProjects.add(projetoRaw);
    if (epicLinkUrl && !projectEpicLink.has(projetoRaw)) projectEpicLink.set(projetoRaw, epicLinkUrl);

    const statusNormalized = String(status || 'planejado').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const totalDuration = renderEnd - renderStart;
    const targetDuration = childTarget ? (childTarget - renderStart) : totalDuration;
    let targetPercent = totalDuration > 0 ? (targetDuration / totalDuration) * 100 : 100;
    targetPercent = Math.max(0, Math.min(100, targetPercent));

    // Cores padronizadas iguais às da aba "Geral"
    let style;
    if (childTarget && renderEnd > childTarget) {
      style = `background: linear-gradient(to right, rgba(33, 128, 141, 0.15) 0%, rgba(33, 128, 141, 0.15) ${targetPercent}%, rgba(255, 103, 31, 0.6) ${targetPercent}%, rgba(255, 103, 31, 0.6) 100%) !important; border-color: var(--color-primary) !important;`;
    } else {
      style = `background-color: rgba(33, 128, 141, 0.15) !important; border-color: var(--color-primary) !important;`;
    }

    const tooltipHtml = `
      <div style="font-size:0.9rem; line-height:1.5; min-width: 250px;">
        <strong style="color:var(--color-primary); font-size:1rem; display:block; margin-bottom:4px;">${resumo}</strong>
        <b>Projeto:</b> ${projetoRaw}<br/>
        <b>Responsável:</b> ${responsavelRaw || 'Não atribuído'}<br/>
        <b>Status:</b> ${status}<br/>
        <hr style="margin:6px 0; border:0; border-top:1px solid rgba(255,255,255,0.2);">
        <b>Início:</b> ${formatDate(childStart)}<br/>
        <b>Previsão:</b> ${formatDate(childTarget)}<br/>
        <b>Fim Real:</b> ${formatDate(childFinish)}
      </div>
    `;

    items.push({
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
      start: renderStart,
      end: renderEnd,
      group: projetoRaw,
      subgroup: 'child',
      className: `status-${statusNormalized}`,
      style,
      title: tooltipHtml, 
      linkUrl: epicLinkUrl
    });
  }

  const projectsToShow = Array.from(includedProjects);
  const groups = projectsToShow.sort().map(p => ({ id: p, content: extractBracketText(p) }));

projectsToShow.forEach(p => {
    const info = epicByProject.get(p);
    if (!info) return;

const epicTooltip = `
          <div style="font-size:0.9rem; line-height:1.5; min-width: 250px;">
            <strong style="color:var(--color-primary); font-size:1rem; display:block; margin-bottom:4px;">${p}</strong>
            <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background: rgba(255,255,255,0.2); font-weight:800; color:#fff;">EPIC</span>
            <hr style="margin:6px 0; border:0; border-top:1px solid rgba(255,255,255,0.2);">
            <b>Início:</b> ${formatDate(info.start)}<br/>
            <b>Previsão:</b> ${formatDate(info.target)}<br/>
            <b>Fim Real:</b> ${formatDate(info.end)}
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

    items.push({
      id: `epic-${p}`,
      content: epicContent,
      start: info.start,
      end: info.end,
      group: p,
      subgroup: 'epic',
      order: -1000,
      className: 'epic-item',
      style: info.style,
      title: epicTooltip,
      linkUrl: (projectEpicLink.get(p) || null)
    });
  });

  return { items, groups };
}

    // --- FILTER DROPDOWNS ---
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
      const respSelect = document.getElementById('responsavel-filter-detalhes');
      const stSelect = document.getElementById('status-filter-detalhes');

      const currentProj = projSelect.value;
      const currentResp = new Set(Array.from(respSelect.selectedOptions || []).map(o => o.value).filter(v => v !== 'all'));
      const currentSt = new Set(Array.from(stSelect.selectedOptions || []).map(o => o.value).filter(v => v !== 'all'));

      projSelect.innerHTML = '<option value="all">Todos</option>';
      Array.from(availableStacks.detalhamento).sort().forEach(v => {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = extractBracketText(v); projSelect.appendChild(opt);
      });
      if (currentProj !== 'all' && availableStacks.detalhamento.has(currentProj)) projSelect.value = currentProj;

      respSelect.innerHTML = '';
      const allOptR = document.createElement('option'); allOptR.value = 'all'; allOptR.textContent = 'Todos'; respSelect.appendChild(allOptR);
      Array.from(availableResponsaveis.detalhamento).sort().forEach(v => {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (currentResp.has(v)) opt.selected = true; respSelect.appendChild(opt);
      });
      if (currentResp.size === 0) allOptR.selected = true;

      stSelect.innerHTML = '';
      const allOptS = document.createElement('option'); allOptS.value = 'all'; allOptS.textContent = 'Todos'; stSelect.appendChild(allOptS);
      Array.from(availableStatuses.detalhamento).sort().forEach(v => {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (currentSt.has(v)) opt.selected = true; stSelect.appendChild(opt);
      });
      if (currentSt.size === 0) allOptS.selected = true;

      rebuildMultiSelect('responsavel-filter-detalhes');
      rebuildMultiSelect('status-filter-detalhes');
    }

    // --- TIMELINE ---
    function createTimeline(data, pageKey) {
      const containerId = pageKey === 'geral' ? 'visualization' : 'visualization-detalhes';
      const container = document.getElementById(containerId);

      itemLinkMap[pageKey] = new Map(data.items.map(it => [it.id, it.linkUrl]));
      const isDetalhes = (pageKey === 'detalhamento');

const options = {
        width: '100%',
        height: '100%',
        orientation: 'top',
        stack: true,
        stackSubgroups: true,
        subgroupOrder: function (a, b) {
          const orderMap = (pageKey === 'detalhamento') ? { child: 0, epic: 1, spacer: 2 } : { epic: 0, child: 1, spacer: 2 };
          return (orderMap[a] ?? 99) - (orderMap[b] ?? 99);
        },
        groupHeightMode: isDetalhes ? 'auto' : 'fitItems',
        groupWidth: getComputedStyle(document.documentElement).getPropertyValue('--stack-col-width').trim() || '220px',
        margin: { axis: isDetalhes ? 52 : 40, item: { horizontal: 10, vertical: isDetalhes ? 26 : 18 } },
        showCurrentTime: false,
        zoomMin: ZOOM_MIN_RANGE,
        zoomMax: ZOOM_MAX_RANGE,
        locale: 'pt-BR',
        verticalScroll: true, 
        horizontalScroll: false, 
        zoomable: false, /* Isso desliga o zoom no scroll da forma correta e nativa */
        tooltip: {
          followMouse: true,
          overflowMethod: 'cap'
        }
      };

        function bindCtrlWheelZoom(container, pageKey) {
      if (!container) return;
      container.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return; 
        e.preventDefault(); 
        e.stopPropagation(); // <--- Adicione esta linha para bloquear a Timeline de dar um zoom estranho
        
        let currentZ = componentZoom[pageKey];
        const zoomStep = 0.1;
        if (e.deltaY < 0) { currentZ += zoomStep; } else { currentZ -= zoomStep; }
        
        updateZoomCSS(pageKey, currentZ);
      }, { passive: false });
    }

      if (timelines[pageKey]) {
        timelines[pageKey].setItems(data.items);
        timelines[pageKey].setGroups(data.groups);
      } else {
        timelines[pageKey] = new vis.Timeline(container, data.items, data.groups, options);
      }

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
        case 'week': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14); end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14); break;
        case 'month': start = new Date(now.getFullYear(), now.getMonth() - 2, 1); end = new Date(now.getFullYear(), now.getMonth() + 2, 0); break;
        case 'quarter': start = new Date(now.getFullYear(), now.getMonth() - 4, 1); end = new Date(now.getFullYear(), now.getMonth() + 4, 0); break;
        case 'year': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() + 1, 11, 31); break;
        default: return;
      }
      tl.setWindow(start, end, { animation: false });
      ensureTodayMarker(pageKey);
    }

    // --- APPLY FILTERS ---
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
      const resp = Array.from(respEl.selectedOptions || []).map(o => o.value);
      const st = Array.from(stEl.selectedOptions || []).map(o => o.value);
      const respFilters = resp.length ? resp : ['all'];
      const stFilters = st.length ? st : ['all'];
      const data = parseSheetDataDetalhamento(allParsedData.detalhamento, proj, respFilters, stFilters, getCardsModeDetalhamento());
      createTimeline(data, 'detalhamento');
      updateDetalhamentoFilters();
      updateCardsModeLabel();
    }

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
          // CHAMADA ATUALIZADA AQUI:
          updateFiltersAvaliacoes(); 
          applyFilterAvaliacoes();
          
          document.getElementById('refresh-data-avaliacoes').style.display = 'inline-flex';
        }
        else {
          // LÓGICA ANTIGA DO ROADMAP (Geral e Detalhamento)
          if (!url) { showStatus('error', 'Configure a fonte de dados.', pageKey); return; }
          const rows = await fetchCSV(url);
          allParsedData[pageKey] = rows;

          if (pageKey === 'geral') {
            updateGroupingModeLabel();
            const data = parseSheetDataGeral(rows, 'all', getGroupingModeGeral());
            createTimeline(data, 'geral');
            updateStackFilterGeral();
          } else if (pageKey === 'detalhamento') {
            const data = parseSheetDataDetalhamento(rows, 'all', 'all', 'all');
            createTimeline(data, 'detalhamento');
            updateDetalhamentoFilters();
          }
          document.getElementById('refresh-data' + suffix).style.display = 'inline-flex';
          setTimeout(() => { if (timelines[pageKey]) timelines[pageKey].redraw(); }, 80);
        }

        showStatus('success', 'Dados carregados com sucesso.', pageKey);
        setTimeout(() => clearStatus(pageKey), 2500);
      } catch (e) { 
        showStatus('error', e.message || 'Erro ao carregar dados.', pageKey); 
      }
    }

    async function handleRefreshData(pageKey) {
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

    // --- MODAL ---
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
      const newUrl = sourceInput.value.trim(); document.getElementById(currentPage === 'geral' ? 'spreadsheet-url' : 'spreadsheet-url-detalhes').value = newUrl;
      closeModal(); handleLoadData(currentPage);
    });
    sourceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });
    document.getElementById('show-example').addEventListener('click', (e) => {
      e.preventDefault(); const exampleUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1XWEct_XM9RKexp9EDzkiW-VDsoQi6fS9m2qr36J2Kkih8ivQjhnWbdgOV8cgTH8vcqzGdObzTJWt/pub?gid=591233746&single=true&output=csv';
      document.getElementById(currentPage === 'geral' ? 'spreadsheet-url' : 'spreadsheet-url-detalhes').value = exampleUrl; sourceInput.value = exampleUrl;
    });

    // --- BINDINGS ---
    document.getElementById('stack-filter').addEventListener('change', applyFilterGeral);
    const groupingToggle = document.getElementById('grouping-toggle-geral');
    if (groupingToggle) { groupingToggle.addEventListener('change', () => { updateGroupingModeLabel(); applyFilterGeral(); }); }
    document.getElementById('view-mode').addEventListener('change', () => changeViewMode('geral'));

    document.getElementById('stack-filter-detalhes').addEventListener('change', applyFilterDetalhamento);
    document.getElementById('responsavel-filter-detalhes').addEventListener('change', applyFilterDetalhamento);
    document.getElementById('status-filter-detalhes').addEventListener('change', applyFilterDetalhamento);

    const cardsModeToggle = document.getElementById('cards-mode-toggle-detalhes');
    if (cardsModeToggle) { cardsModeToggle.addEventListener('change', () => { updateCardsModeLabel(); applyFilterDetalhamento(); }); }
    document.getElementById('view-mode-detalhes').addEventListener('change', () => changeViewMode('detalhamento'));

    // Botões de Zoom do Eixo X (Lateral)
    document.getElementById('zoom-in').addEventListener('click', () => { const tl = timelines.geral; if (!tl) return; const w = tl.getWindow(); const start = w.start.valueOf(); const end = w.end.valueOf(); const mid = (start + end) / 2; let range = Math.max(ZOOM_MIN_RANGE, (end - start) * 0.8); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
    document.getElementById('zoom-out').addEventListener('click', () => { const tl = timelines.geral; if (!tl) return; const w = tl.getWindow(); const start = w.start.valueOf(); const end = w.end.valueOf(); const mid = (start + end) / 2; let range = Math.min(ZOOM_MAX_RANGE, (end - start) * 1.25); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
    document.getElementById('zoom-fit').addEventListener('click', () => { if (timelines.geral) timelines.geral.fit({ animation: false }); });

    document.getElementById('zoom-in-detalhes').addEventListener('click', () => { const tl = timelines.detalhamento; if (!tl) return; const w = tl.getWindow(); const start = w.start.valueOf(); const end = w.end.valueOf(); const mid = (start + end) / 2; let range = Math.max(ZOOM_MIN_RANGE, (end - start) * 0.8); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
    document.getElementById('zoom-out-detalhes').addEventListener('click', () => { const tl = timelines.detalhamento; if (!tl) return; const w = tl.getWindow(); const start = w.start.valueOf(); const end = w.end.valueOf(); const mid = (start + end) / 2; let range = Math.min(ZOOM_MAX_RANGE, (end - start) * 1.25); tl.setWindow(mid - range/2, mid + range/2, { animation: false }); });
    document.getElementById('zoom-fit-detalhes').addEventListener('click', () => { if (timelines.detalhamento) timelines.detalhamento.fit({ animation: false }); });

    document.getElementById('load-data').addEventListener('click', () => handleLoadData('geral'));
    document.getElementById('refresh-data').addEventListener('click', () => handleRefreshData('geral'));
    document.getElementById('load-data-detalhes').addEventListener('click', () => handleLoadData('detalhamento'));
    document.getElementById('refresh-data-detalhes').addEventListener('click', () => handleRefreshData('detalhamento'));

    document.getElementById('aba-filter-avaliacoes').addEventListener('change', applyFilterAvaliacoes);
    document.getElementById('load-data-avaliacoes').addEventListener('click', () => handleLoadData('avaliacoes'));
    document.getElementById('refresh-data-avaliacoes').addEventListener('click', () => handleLoadData('avaliacoes')); // Usaremos handleLoad direto para forçar download

    // Auto-load
    window.addEventListener('DOMContentLoaded', () => {
      handleLoadData('geral');
      handleLoadData('detalhamento');
      handleLoadData('avaliacoes'); // <- NOVA TELA CARREGA AUTOMÁTICO AQUI
    });

     // ==========================================
    // FUNÇÕES DA PÁGINA DE AVALIAÇÕES (GRÁFICOS)
    // ==========================================

    function extractMonthYear(dateString) {
      const d = parseBRDate(dateString); // Aproveitamos sua função que já trata datas BR
      if (!d) return null;
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${yyyy}`;
    }

    function updateFiltersAvaliacoes() {
      // 1. Atualiza filtro de ABAS
      const selectAba = document.getElementById('aba-filter-avaliacoes');
      const currentAba = selectAba.value;
      selectAba.innerHTML = '<option value="all">Todas as Áreas (Consolidado)</option>';
      Object.keys(allParsedData.avaliacoes).sort().forEach(nomeAba => {
        const opt = document.createElement('option'); opt.value = nomeAba; opt.textContent = nomeAba; selectAba.appendChild(opt);
      });
      if (currentAba !== 'all' && allParsedData.avaliacoes[currentAba]) selectAba.value = currentAba;

      // 2. Atualiza filtro de MESES
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
      // Ordena os meses decrescente (mais novo primeiro)
      Array.from(availableMeses).sort((a,b) => {
        const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
        return new Date(y2, m2-1) - new Date(y1, m1-1); 
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
        if (aba !== 'all' && nomeAba !== aba) return; // Corta se não for da aba selecionada
        
        rows.forEach(row => {
          if (mes !== 'all') {
            const rowMes = extractMonthYear(getCell(row, ['Carimbo de data/hora', 'Timestamp', 'Data']));
            if (rowMes !== mes) return; // Corta se não for do mês selecionado
          }
          // Injeta de qual aba veio para agruparmos depois
          row._abaOrigin = nomeAba; 
          filteredRows.push(row);
        });
      });
      
      renderGraficosAvaliacoes(filteredRows);
    }

    function renderGraficosAvaliacoes(rows) {
      // ==== 1. CÁLCULO NPS ====
      let promoters = 0; let passives = 0; let detractors = 0;
      let npsCounts = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0};
      
      rows.forEach(row => {
        const npsRaw = getCell(row, ['NPS', '0 a 10', 'recomendaria', 'recomendar']);
        if (npsRaw !== undefined && npsRaw !== '') {
          const score = parseInt(npsRaw, 10);
          if (!isNaN(score) && score >= 0 && score <= 10) {
            npsCounts[score]++;
            if (score >= 9) promoters++;
            else if (score >= 7) passives++;
            else detractors++;
          }
        }
      });

      const totalNps = promoters + passives + detractors;
      const npsScore = totalNps > 0 ? Math.round(((promoters / totalNps) - (detractors / totalNps)) * 100) : 0;
      
      const npsTextEl = document.getElementById('nps-score-text');
      document.getElementById('nps-total-text').textContent = `${totalNps} avaliações`;
      npsTextEl.textContent = totalNps > 0 ? npsScore : '-';
      
      if (npsScore >= 75) npsTextEl.style.color = '#10B981'; 
      else if (npsScore >= 50) npsTextEl.style.color = '#3B82F6';
      else if (npsScore >= 0) npsTextEl.style.color = '#F59E0B';
      else npsTextEl.style.color = '#EF4444';

      // ---- GRÁFICO NPS (BARRAS DE 0 a 10) ----
      if (chartInstances.nps) chartInstances.nps.destroy();
      const npsLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      
      // Separamos em 3 datasets para a legenda com emojis funcionar com cores distintas
      const dataDetratores = npsLabels.map(l => parseInt(l) <= 6 ? npsCounts[l] : null);
      const dataNeutros = npsLabels.map(l => parseInt(l) >= 7 && parseInt(l) <= 8 ? npsCounts[l] : null);
      const dataPromotores = npsLabels.map(l => parseInt(l) >= 9 ? npsCounts[l] : null);

      chartInstances.nps = new Chart(document.getElementById('npsChart'), {
        type: 'bar',
        data: {
          labels: npsLabels,
          datasets: [
            { label: '😡 Detratores', data: dataDetratores, backgroundColor: '#EF4444', borderRadius: 4 },
            { label: '😐 Neutros', data: dataNeutros, backgroundColor: '#FCD34D', borderRadius: 4 },
            { label: '🤩 Promotores', data: dataPromotores, backgroundColor: '#10B981', borderRadius: 4 }
          ]
        },
        options: {
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { stacked: true, title: { display: true, text: 'Nota' } },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Qtd de Respostas' } }
          }
        }
      });

      // ==== 2. GRÁFICOS DE SATISFAÇÃO (Por Perguntas) ====
      const satContainer = document.getElementById('sat-charts-container');
      satContainer.innerHTML = ''; 
      Object.values(chartInstancesSat).forEach(c => c.destroy()); 
      chartInstancesSat = {};

      if (rows.length === 0) {
        satContainer.innerHTML = '<p style="color:#626c71; text-align:center;">Nenhum dado encontrado para este filtro.</p>';
        return;
      }

      // Agrupa as respostas separadas por qual "Aba/Form" elas vieram
      const rowsByAba = {};
      rows.forEach(r => {
        if (!rowsByAba[r._abaOrigin]) rowsByAba[r._abaOrigin] = [];
        rowsByAba[r._abaOrigin].push(r);
      });

      // Cria um gráfico para cada Aba
      Object.keys(rowsByAba).sort().forEach((abaName, index) => {
        const abaRows = rowsByAba[abaName];
        if (abaRows.length === 0) return;

        // Vasculha as colunas dessa aba procurando por perguntas de satisfação
        const headers = Object.keys(abaRows[0]);
        const satHeaders = headers.filter(h => 
          (/grau|satisfa|avalia|satisfeito|atendimento/i.test(h)) && 
          (!/nps|0 a 10|recomend/i.test(h))
        );

        if (satHeaders.length === 0) return; 

        const labels = [];
        const averages = [];

        // Calcula a média de cada pergunta (coluna) achada
        satHeaders.forEach(h => {
          let sum = 0, count = 0;
          abaRows.forEach(r => {
            const val = parseFloat(r[h]);
            if (!isNaN(val)) { sum += val; count++; }
          });
          if (count > 0) {
            labels.push(h); // A própria pergunta vira o rótulo do eixo Y
            averages.push((sum/count).toFixed(2));
          }
        });

        if (labels.length === 0) return;

        // Injeta o HTML (título da aba + canvas)
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
          <h4 style="font-size:0.95rem; color:#626c71; margin-bottom:8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Formulário: ${abaName}</h4>
          <canvas id="satChart_${index}" style="max-height: 250px;"></canvas>
        `;
        satContainer.appendChild(wrapper);

        // Desenha o gráfico Horizontal
        chartInstancesSat[abaName] = new Chart(document.getElementById(`satChart_${index}`), {
          type: 'bar',
          data: {
            // Se a pergunta for gigante, corta com "..."
            labels: labels.map(l => l.length > 55 ? l.substring(0, 52) + '...' : l), 
            datasets: [{
              label: 'Nota Média',
              data: averages,
              backgroundColor: '#ec6718', // Laranja Caaqui
              borderRadius: 4
            }]
          },
          options: {
            indexAxis: 'y', // <-- Isso deita o gráfico (Barras Horizontais)
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, max: 5 }, // Assume escala de notas até 5 (você pode alterar para 10 se for o caso do seu Forms)
              y: { ticks: { autoSkip: false } }

    document.getElementById('aba-filter-avaliacoes').addEventListener('change', applyFilterAvaliacoes);
    document.getElementById('mes-filter-avaliacoes').addEventListener('change', applyFilterAvaliacoes); // <--- Ouvi o mês novo
    document.getElementById('load-data-avaliacoes').addEventListener('click', () => handleLoadData('avaliacoes'));
    document.getElementById('refresh-data-avaliacoes').addEventListener('click', () => handleLoadData('avaliacoes'));
            }
          }
        });
    }

