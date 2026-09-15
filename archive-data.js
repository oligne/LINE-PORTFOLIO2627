(function () {
  const DATA_URL = './docs/archive_project_database_template.xlsx';

  window.loadArchiveGraphSource = async function loadArchiveGraphSource() {
    if (!window.XLSX) {
      throw new Error('SheetJS is required to read archive_project_database_template.xlsx');
    }

    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Unable to load ${DATA_URL}`);
    }

    const workbook = window.XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const projectRows = sheetRows(workbook, 'Projets');
    const projects = buildProjects(projectRows);
    const links = buildLinks(projectRows, projects);
    const softwareLinks = buildSoftwareLinks(projects);

    links.progression.forEach((link) => {
      const target = projects.find((project) => project.id === link.target);
      if (target && !target.follows.includes(link.source)) {
        target.follows.push(link.source);
      }
    });

    return {
      startYear: 2020,
      endYear: 2026,
      projects,
      poles: buildPoles(),
      progressionLinks: links.progression,
      exchanges: links.exchanges,
      softwareLinks,
      themes: []
    };
  };

  function sheetRows(workbook, name) {
    const sheet = workbook.Sheets[name];
    if (!sheet) return [];
    return window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  function buildProjects(rows) {
    const projects = rows
      .filter(isGraphProject)
      .map((row, index) => {
        const title = stringValue(row.nom || row.titre);
        const startDate = parseDate(row.date_debut) || dateFromParts(row.annee_debut, row.mois_debut);
        const endDate = parseDate(row.date_fin) || dateFromParts(row.annee_fin, row.mois_fin) || startDate;
        const year = startDate ? startDate.year : 2026;
        const id = stringValue(row.id) || slugify(title);
        const category = stringValue(row.categorie);
        const layout = layoutSeed(row, year, index);

        const rawSize = numberValue(row.size) || numberValue(row.point_size) || numberValue(row.taille_point) || 0;
        const size = clamp(Math.round(rawSize) || 0, 0, 3) || 0;

        return {
          id,
          title,
          year,
          startDate,
          endDate,
          date: formatDateRange(startDate, endDate) || String(year),
          type: 'project',
          category,
          pole: normalizePole(category),
          scale: clamp(numberValue(row.taille) || numberValue(row.echelle_visuelle_0_1) || 0.62, 0.25, 1.15),
          size,
          themes: [],
          tools: splitTags(row.logiciels),
          toolKeys: splitTags(row.logiciels).map(normalizeToken).filter(Boolean),
          categoryKeys: splitTags(category).map(normalizeToken).filter(Boolean),
          mediums: [],
          context: '',
          layout,
          follows: splitLinks(row.liens || row.liens_progression_ids)
        };
      });

    // do not compute positions here. graph handles layout and positioning.
    return projects;
  }

  function buildLinks(rows, projects) {
    const progression = [];
    const exchanges = [];
    const projectIds = new Set(projects.map((project) => project.id));
    const projectLookup = buildProjectLookup(projects);

    rows.forEach((row) => {
      const target = resolveProjectId(row.id, projectLookup);
      if (!target || !projectIds.has(target)) return;
      const startDate = parseDate(row.date_debut) || dateFromParts(row.annee_debut, row.mois_debut);
      const year = startDate ? startDate.year : 2026;

      splitLinks(row.liens || row.liens_progression_ids).forEach((source) => {
        const sourceId = resolveProjectId(source, projectLookup);
        if (sourceId && projectIds.has(sourceId)) progression.push({ source: sourceId, target, year, curve: 0 });
      });

      splitLinks(row.echanges || row.liens_echange_ids).forEach((source) => {
        const sourceId = resolveProjectId(source, projectLookup);
        if (sourceId && projectIds.has(sourceId)) exchanges.push({ source: sourceId, target, year, curve: 0.24 });
      });
    });

    return { progression, exchanges };
  }

  function buildProjectLookup(projects) {
    const lookup = new Map();
    projects.forEach((project) => {
      [project.id, project.title, slugify(project.title), normalizeToken(project.title)].forEach((key) => {
        const normalized = normalizeToken(key);
        if (normalized && !lookup.has(normalized)) lookup.set(normalized, project.id);
      });
    });
    return lookup;
  }

  function resolveProjectId(value, lookup) {
    const raw = stringValue(value);
    if (!raw) return '';
    return lookup.get(normalizeToken(raw)) || raw;
  }

  function buildSoftwareLinks(projects) {
    const groups = new Map();

    projects.forEach((project) => {
      project.tools.forEach((tool) => {
        const key = normalizeToken(tool);
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(project);
      });
    });

    const links = new Map();
    groups.forEach((items, tool) => {
      if (items.length < 2) return;
      const sorted = items
        .slice()
        .sort((a, b) => monthValue(a.startDate) - monthValue(b.startDate) || a.id.localeCompare(b.id));

      sorted.forEach((project, index) => {
        [sorted[index + 1]].forEach((next, offset) => {
          if (!next) return;
          addSoftwareLink(links, project, next, tool, (index + offset) % 2 ? -0.18 : 0.18);
        });
      });

      if (sorted.length <= 4) {
        for (let i = 0; i < sorted.length; i += 1) {
          for (let j = i + 2; j < sorted.length; j += 1) {
            addSoftwareLink(links, sorted[i], sorted[j], tool, (i + j) % 2 ? -0.14 : 0.14);
          }
        }
      }
    });

    return Array.from(links.values());
  }

  function addSoftwareLink(links, source, target, tool, curve) {
    const ids = [source.id, target.id].sort();
    const key = `${ids[0]}--${ids[1]}`;
    const existing = links.get(key);

    if (existing) {
      if (!existing.tools.includes(tool)) existing.tools.push(tool);
      existing.tool = existing.tools.join(', ');
      existing.strength = Math.min(1, existing.strength + 0.18);
      return;
    }

    links.set(key, {
      source: source.id,
      target: target.id,
      year: Math.max(source.year, target.year),
      curve,
      tool,
      tools: [tool],
      strength: 0.42
    });
  }

  function buildPoles() {
    return [
      { id: 'space-pure', title: 'Espace pur', type: 'pole', year: 2020, scale: 0.38, position: { x: -176, y: -22 } },
      { id: 'digital-space', title: 'Numerique espace', type: 'pole', year: 2023, scale: 0.42, position: { x: 70, y: 44 } },
      { id: 'digital-pure', title: 'Numerique pur', type: 'pole', year: 2025, scale: 0.38, position: { x: 192, y: -34 } }
    ];
  }

  function isGraphProject(row) {
    const title = stringValue(row.nom || row.titre);
    const category = stringValue(row.categorie).toLowerCase();
    const include = stringValue(row.inclure_graph).toLowerCase();
    return stringValue(row.id) && title && include !== 'non' && !category.includes('document');
  }

  function layoutSeed(row, year, index) {
    const axes = inferAxes(`${row.categorie || row.pole_principal}, ${row.logiciels || ''}`);
    const yearRatio = clamp((year - 2020) / 6, 0, 1);
    const chronologicalX = (yearRatio - 0.5) * 382;
    const localX = Math.sin(index * 1.73) * 24;
    const localY = Math.cos(index * 1.31) * 34;
    const wave = Math.sin(yearRatio * Math.PI * 2.1 - 0.35) * 24;
    const centers = {
      space: { y: -86 },
      hybrid: { y: 82 },
      pure: { y: -48 }
    };
    const total = axes.space + axes.hybrid + axes.pure;

    return {
      x: chronologicalX + localX,
      y: (centers.space.y * axes.space + centers.hybrid.y * axes.hybrid + centers.pure.y * axes.pure) / total + wave + localY
    };
  }

  function distributeProjects(projects) {
    // data only used for import; graph computes layout. no-op here.
    return projects;
  }

  function separatePair(first, second) {
    const dx = second.position.x - first.position.x;
    const dy = second.position.y - first.position.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const sameYear = first.year === second.year;
    const sameCategory = normalizeToken(first.category) === normalizeToken(second.category);
    const sharedTool = first.tools.some((tool) => second.tools.map(normalizeToken).includes(normalizeToken(tool)));
    const wanted = 22 + (first.scale + second.scale) * 8 + (sameYear ? 8 : 0) + (!sameCategory ? 4 : 0) - (sharedTool ? 4 : 0);
    if (distance >= wanted) return;

    const push = (wanted - distance) * 0.5;
    const nx = dx / distance;
    const ny = dy / distance;
    const yWeight = sameYear ? 1.28 : 0.96;

    first.position.x -= nx * push * 0.34;
    first.position.y -= ny * push * yWeight * 1.28;
    second.position.x += nx * push * 0.34;
    second.position.y += ny * push * yWeight * 1.28;
  }

  function attractPair(first, second, strength) {
    const dx = second.position.x - first.position.x;
    const dy = second.position.y - first.position.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = 92;
    if (distance <= desired) return;
    const pull = (distance - desired) * strength;
    const nx = dx / distance;
    const ny = dy / distance;

    first.position.x += nx * pull;
    first.position.y += ny * pull;
    second.position.x -= nx * pull;
    second.position.y -= ny * pull;
  }

  function inferAxes(value) {
    const category = stringValue(value).toLowerCase();
    const hasSpace = category.includes('espace') || category.includes('arch') || category.includes('mat') || category.includes('site') || category.includes('craft') || category.includes('rhino') || category.includes('autocad') || category.includes('indesign');
    const hasNum = category.includes('num') || category.includes('web') || category.includes('3d') || category.includes('vr') || category.includes('interactif') || category.includes('temps') || category.includes('touchdesigner') || category.includes('program');
    const hasPure = category.includes('pur') || category.includes('web') || category.includes('3d') || category.includes('vr') || category.includes('temps') || category.includes('procedural') || category.includes('touchdesigner') || category.includes('program') || category.includes('live');

    if (hasSpace && hasNum) return { space: 2, hybrid: 5, pure: hasPure ? 2 : 1 };
    if (hasPure || (hasNum && !hasSpace)) return { space: 0, hybrid: 2, pure: 5 };
    if (hasSpace) return { space: 5, hybrid: 1, pure: 0 };
    return { space: 2, hybrid: 3, pure: 1 };
  }

  function normalizePole(value) {
    const axes = inferAxes(value);
    if (axes.pure >= axes.hybrid && axes.pure >= axes.space) return 'digital-pure';
    if (axes.hybrid >= axes.space) return 'digital-space';
    return 'space-pure';
  }

  function splitLinks(value) {
    return stringValue(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitTags(value) {
    return stringValue(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeToken(value) {
    return stringValue(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseDate(value) {
    const raw = stringValue(value).toLowerCase();
    if (!raw) return null;
    const match = raw.match(/(20\d{2})(?:[-/\s]+([a-zA-Zéûùôîïàèç]+|\d{1,2}))?/);
    if (!match) return null;
    return { year: Number(match[1]), month: normalizeMonth(match[2]) };
  }

  function dateFromParts(yearValue, monthValue) {
    const year = numberValue(yearValue);
    if (!year) return null;
    return { year, month: normalizeMonth(monthValue) };
  }

  function formatDateRange(startDate, endDate) {
    if (!startDate) return '';
    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : '';
    if (!end || start === end) return start;
    return `${start} - ${end}`;
  }

  function formatDate(date) {
    if (!date) return '';
    return date.month ? `${date.year}-${String(date.month).padStart(2, '0')}` : String(date.year);
  }

  function monthValue(date) {
    if (!date) return 0;
    return date.year * 12 + (date.month || 1);
  }

  function normalizeMonth(value) {
    const raw = stringValue(value).toLowerCase();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return clamp(Number(raw), 1, 12);
    const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 4);
    const months = {
      janv: 1,
      fevr: 2,
      mars: 3,
      avri: 4,
      mai: 5,
      juin: 6,
      juil: 7,
      aout: 8,
      sept: 9,
      octo: 10,
      nove: 11,
      dece: 12
    };
    return months[key] || null;
  }

  function stringValue(value) {
    return value == null ? '' : String(value).trim();
  }

  function numberValue(value) {
    if (value === '' || value == null) return 0;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function slugify(value) {
    return stringValue(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}());
