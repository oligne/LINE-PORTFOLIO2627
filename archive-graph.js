(function () {
  const graphEl = document.getElementById('archive-graph');
  const timelineEl = document.getElementById('archive-timeline');
  const currentYearEl = document.getElementById('archive-current-year');
  const statusEl = document.getElementById('archive-status');

  if (!graphEl || !timelineEl) return;

  const sourcePromise = typeof window.loadArchiveGraphSource === 'function'
    ? window.loadArchiveGraphSource()
    : Promise.resolve(window.ARCHIVE_GRAPH_SOURCE);

  sourcePromise
    .then((source) => {
      if (!source) throw new Error('Archive source is empty');
      initArchiveGraph(source);
    })
    .catch((error) => {
      graphEl.classList.add('archive-graph-fallback');
      graphEl.textContent = window.PortfolioI18n?.t('archiveDataUnavailable') || 'Archive data unavailable';
      console.error(error);
    });

  function initArchiveGraph(source) {

  const startMonth = source.startYear * 12;
  const endMonth = source.endYear * 12 + 11;
  const totalMonths = endMonth - startMonth + 1;
  const verticalCompression = 0.9;
  const supportNodeType = 'support';
  const dragInfluenceRadius = 92;
  const dragInfluenceStrength = 0.28;
  const exitDuration = 320;
  const exitTimers = new Map();
  const years = [];

  for (let year = source.startYear; year <= source.endYear; year += 1) {
    years.push(year);
  }

  const allNodes = buildNodes();
  const supportNodes = buildSupportNodes();
  const allLinks = buildLinks();
  const layoutBounds = getNodeBounds(allNodes.filter((node) => node.type === 'project'));
  let visibleStartMonth = source.endYear * 12;
  let graph = null;
  let handleEl = null;
  let isDragging = false;
  let lastNodeCount = 0;
  let lastLinkCount = 0;

  buildTimeline();
  initGraph();
  setVisibleStart(visibleStartMonth, false);

  if (window.PortfolioI18n) {
    window.PortfolioI18n.refreshArchive = refreshArchiveLabels;
  }

  function buildNodes() {
    const projectNodes = source.projects.map((project, index) => {
      const month = projectMonth(project);
      const activeEndMonth = projectEndMonth(project);
      const fallback = fallbackPosition(month, index);
      const x = project.position ? project.position.x : fallback.x;
      const y = (project.position ? project.position.y : fallback.y) * verticalCompression;

      const baseScale = typeof project.scale === 'number' ? project.scale : 0.6;
      // size: 1,2,3 (3 = current size). Map to multipliers for coherent visual sizes.
      const sizeMultiplier = typeof project.size === 'number'
        ? (project.size === 3 ? 1 : project.size === 2 ? 0.66 : 0.42)
        : 1;

      return {
        ...project,
        month,
        activeStartMonth: month,
        activeEndMonth,
        val: Math.max(1, Math.round((4 + baseScale * 8) * sizeMultiplier)),
        radius: (3 + baseScale * 3.4) * sizeMultiplier,
        homeX: x,
        homeY: y,
        targetX: x,
        targetY: y,
        x,
        y
      };
    });

    const poleNodes = (source.poles || []).map((pole, index) => {
      const month = pole.year * 12;
      const fallback = fallbackPosition(month, index);
      const x = pole.position ? pole.position.x : fallback.x;
      const y = (pole.position ? pole.position.y : fallback.y) * verticalCompression;

      return {
        ...pole,
        month,
        activeStartMonth: month,
        activeEndMonth: month,
        val: 2,
        radius: 2.2 + pole.scale * 2,
        hidden: true,
        homeX: x,
        homeY: y,
        targetX: x,
        targetY: y,
        x,
        y
      };
    });

    return [...projectNodes, ...poleNodes];
  }

  function buildSupportNodes() {
    const projectNodes = allNodes.filter((node) => node.type === 'project');
    const bounds = projectNodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.targetX),
      maxX: Math.max(acc.maxX, node.targetX),
      minY: Math.min(acc.minY, node.targetY),
      maxY: Math.max(acc.maxY, node.targetY)
    }), {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
    const padX = 18;
    const padY = 16;

    return [
      supportNode('support-left', bounds.minX - padX, bounds.minY - padY),
      supportNode('support-right', bounds.maxX + padX, bounds.maxY + padY)
    ];
  }

  function supportNode(id, x, y) {
    return {
      id,
      type: supportNodeType,
      hidden: true,
      month: startMonth,
      val: 1,
      radius: 1,
      homeX: x,
      homeY: y,
      targetX: x,
      targetY: y,
      x,
      y
    };
  }

  function buildLinks() {
    const links = [];

    if (Array.isArray(source.progressionLinks)) {
      source.progressionLinks.forEach((link) => {
        links.push({
          source: link.source,
          target: link.target,
          type: 'progression',
          month: (link.year || source.endYear) * 12,
          curve: link.curve || 0
        });
      });
    } else {
      source.projects.forEach((project) => {
        const month = projectMonth(project);

        project.follows.forEach((previousId) => {
          links.push({
            source: previousId,
            target: project.id,
            type: 'progression',
            month,
            curve: 0
          });
        });
      });
    }

    (source.exchanges || []).forEach((exchange) => {
      links.push({
        source: exchange.source,
        target: exchange.target,
        type: 'exchange',
        month: exchange.year * 12,
        curve: 0
      });
    });

    (source.softwareLinks || []).forEach((softwareLink) => {
      links.push({
        source: softwareLink.source,
        target: softwareLink.target,
        type: 'software',
        month: softwareLink.year * 12,
        curve: softwareLink.curve || 0.18,
        tool: softwareLink.tool,
        tools: softwareLink.tools || (softwareLink.tool ? [softwareLink.tool] : []),
        strength: softwareLink.strength || 0.42
      });
    });

    return shapeProjectLinks(links);
  }

  function shapeProjectLinks(links) {
    return links
      .map((link, index) => {
        if (link.type === 'progression' || link.type === 'exchange') return { ...link, __index: index, curve: 0 };
        return { ...link, __index: index };
      })
      .sort((a, b) => linkDrawRank(a) - linkDrawRank(b) || indexRank(a) - indexRank(b));

    function indexRank(link) {
      return typeof link.__index === 'number' ? link.__index : 0;
    }
  }

  function linkDrawRank(link) {
    if (link.type === 'software') return 0;
    if (link.type === 'exchange') return 1;
    return 2;
  }

  function buildTimeline() {
    const ticksEl = document.createElement('div');
    ticksEl.className = 'archive-ticks';

    for (let i = 0; i < totalMonths; i += 1) {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'archive-tick';
      tick.dataset.month = String(startMonth + i);
      tick.setAttribute('aria-label', tickLabel(startMonth + i));
      tick.addEventListener('click', () => setVisibleStart(startMonth + i, true));
      ticksEl.appendChild(tick);
    }

    handleEl = document.createElement('button');
    handleEl.type = 'button';
    handleEl.className = 'archive-range-handle';
    handleEl.setAttribute('aria-label', window.PortfolioI18n?.t('archiveRangeHandleLabel') || 'Start of visible archive range');
    handleEl.addEventListener('pointerdown', startDrag);

    const labelsEl = document.createElement('div');
    labelsEl.className = 'archive-year-labels';
    years.forEach((year) => {
      const label = document.createElement('button');
      label.type = 'button';
      label.textContent = year;
      label.dataset.year = String(year);
      label.addEventListener('click', () => setVisibleStart(year * 12, true));
      labelsEl.appendChild(label);
    });

    timelineEl.append(ticksEl, handleEl, labelsEl);
  }

  function initGraph() {
    if (typeof ForceGraph !== 'function') {
      graphEl.classList.add('archive-graph-fallback');
      graphEl.textContent = window.PortfolioI18n?.t('archiveGraphUnavailable') || 'Archive graph unavailable';
      return;
    }

    graph = ForceGraph()(graphEl)
      .backgroundColor('rgba(255,255,255,0)')
      .width(graphEl.clientWidth)
      .height(graphEl.clientHeight)
      .enablePointerInteraction(true)
      .enableNodeDrag(true)
      .enablePanInteraction(false)
      .enableZoomInteraction(false)
      .autoPauseRedraw(false)
      .cooldownTicks(120)
      .nodeId('id')
      .nodeVal('val')
      .nodeLabel((node) => `${node.title || node.id}${node.date ? ` - ${node.date}` : ''}`)
      .nodeVisibility((node) => !node.hidden)
      .nodeCanvasObject(drawNode)
      .nodeCanvasObjectMode(() => 'replace')
      .linkCanvasObject(drawLink)
      .linkCanvasObjectMode(() => 'replace')
      .nodePointerAreaPaint(paintPointerArea)
      .onNodeHover((node) => {
        graphEl.style.cursor = node && node.type === 'project' ? 'grab' : 'default';
      })
      .onNodeDrag((node) => {
        if (node.type !== 'project') return;
        graphEl.style.cursor = 'grabbing';
        node.__dragging = true;
        const dx = typeof node.__lastDragX === 'number' ? node.x - node.__lastDragX : 0;
        const dy = typeof node.__lastDragY === 'number' ? node.y - node.__lastDragY : 0;
        node.targetX = node.x;
        node.targetY = node.y;
        if (dx || dy) applyLocalDragInfluence(node, dx, dy);
        node.__lastDragX = node.x;
        node.__lastDragY = node.y;
      })
      .onNodeDragEnd((node) => {
        if (node.type !== 'project') return;
        node.__dragging = false;
        delete node.__lastDragX;
        delete node.__lastDragY;
        node.targetX = node.x;
        node.targetY = node.y;
        graphEl.style.cursor = 'grab';
      })
      .graphData({ nodes: [], links: [] });

    graph.d3Force('charge', null);
    graph.d3Force('center', null);
    graph.d3Force('link', null);
    graph.d3Force('layout', layoutForce);

    window.addEventListener('resize', () => {
      if (!graph) return;
      graph.width(graphEl.clientWidth);
      graph.height(graphEl.clientHeight);
      fitGraph(0);
    });
  }

  function setVisibleStart(month, animate) {
    visibleStartMonth = clamp(month, startMonth, endMonth);
    clearStaleExits();
    const currentNodes = graph ? graph.graphData().nodes : [];
    const currentIds = new Set(currentNodes.map((node) => node.id));
    const projectNodes = allNodes.filter(isProjectVisible);
    recalculateVisibleTargets(projectNodes);
    const projectIds = new Set(projectNodes.map((node) => node.id));
    const exitingNodes = animate ? currentNodes
      .filter((node) => node.type === 'project' && !projectIds.has(node.id) && !node.__exitComplete)
      .map((node) => startNodeExit(node, projectNodes, currentNodes)) : [];

    projectNodes.forEach(resetNodeExit);
    projectNodes.forEach((node) => prepareNodeForDynamicEntry(node, currentIds, currentNodes));
    const nodes = [...projectNodes, ...supportNodes];
    exitingNodes.forEach((node) => {
      if (!nodes.includes(node)) nodes.push(node);
    });

    const nodeIds = new Set(nodes.map((node) => node.id));
    const visibleNodeMap = new Map(nodes.map((node) => [node.id, node]));
    const links = allLinks
      .reduce((visibleLinks, link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const sourceNode = visibleNodeMap.get(sourceId);
        const targetNode = visibleNodeMap.get(targetId);
        if (nodeIds.has(sourceId) && nodeIds.has(targetId) && shouldDisplayVisibleLink(link, sourceNode, targetNode)) {
          visibleLinks.push({ ...link, source: sourceId, target: targetId });
        }
        return visibleLinks;
      }, []);

    if (graph) {
      graph.graphData({ nodes, links });
      graph.d3ReheatSimulation();
      fitGraph(animate ? 650 : 0);
    }

    updateTimeline();
    updateStatus(projectNodes.length, links.length);
  }

  function recalculateVisibleTargets(projectNodes) {
    if (!projectNodes.length) return;

    const groups = buildLinkGroups(projectNodes);
    const sorted = groups.flatMap((group) => group.nodes);

    groups.forEach((group) => {
      const nodes = group.nodes
        .slice()
        .sort((a, b) => visibleProjectMonth(a) - visibleProjectMonth(b) || themeRank(a) - themeRank(b) || a.id.localeCompare(b.id));
      const minMonth = Math.min(...nodes.map(visibleProjectMonth));
      const maxMonth = Math.max(...nodes.map(visibleProjectMonth));
      const monthRange = Math.max(1, maxMonth - minMonth);
      const monthCounts = new Map();
      const localSpan = Math.max(24, group.width - 34);

      nodes.forEach((node, index) => {
        const month = visibleProjectMonth(node);
        const count = monthCounts.get(month) || 0;
        monthCounts.set(month, count + 1);
        const chronological = monthRange <= 2
          ? index / Math.max(1, nodes.length - 1)
          : (month - minMonth) / monthRange;
        const sameMonthOffset = (count - 0.5) * 10;
        const themeOffset = (categoryLane(node) - group.averageLane) * 0.28;
        const toolOffset = softwareLaneOffset(node) * 0.05;
        const localWave = nodes.length <= 2
          ? (index - (nodes.length - 1) / 2) * 18
          : Math.sin(index * 1.72 + group.index * 0.7) * (12 + Math.min(nodes.length, 5));
        const islandArc = Math.cos((chronological - 0.5) * Math.PI * 2) * Math.min(16, nodes.length * 2.2);

        node.__linkGroup = group.id;
        node.__visibleBaseX = group.centerX + (chronological - 0.5) * localSpan + sameMonthOffset;
        node.__visibleBaseY = group.centerY + themeOffset + toolOffset + localWave + islandArc;
        node.targetX = node.__visibleBaseX;
        node.targetY = node.__visibleBaseY;
      });
    });

    for (let pass = 0; pass < 44; pass += 1) {
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
          separateVisibleTargets(sorted[i], sorted[j]);
          const affinity = categoryAffinity(sorted[i], sorted[j]);
          if (affinity && sameLinkGroup(sorted[i], sorted[j])) {
            attractVisibleTargets(sorted[i], sorted[j], 78 - affinity * 6, 0.0015 + affinity * 0.0008);
          }
        }
      }

      allLinks.forEach((link) => {
        const sourceNode = sorted.find((node) => node.id === getLinkEndpointId(link.source));
        const targetNode = sorted.find((node) => node.id === getLinkEndpointId(link.target));
        if (!sourceNode || !targetNode) return;
        if (link.type === 'software') {
          if (sameLinkGroup(sourceNode, targetNode)) attractVisibleTargets(sourceNode, targetNode, 112, 0.0008 * (link.strength || 0.42));
        } else if (link.type === 'progression' || link.type === 'exchange') {
          const sameGroup = sameLinkGroup(sourceNode, targetNode);
          attractVisibleTargets(sourceNode, targetNode, sameGroup ? 58 : 112, sameGroup ? 0.007 : 0.0016);
        }
      });

      sorted.forEach((node) => {
        node.targetX += (node.__visibleBaseX - node.targetX) * 0.04;
        node.targetY += (node.__visibleBaseY - node.targetY) * 0.05;
      });
    }
  }

  function separateVisibleTargets(first, second) {
    const dx = second.targetX - first.targetX;
    const dy = second.targetY - first.targetY;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const sameMonth = visibleProjectMonth(first) === visibleProjectMonth(second);
    const directLinked = areNodesLinked(first.id, second.id, ['progression', 'exchange']);
    const softwareLinked = areNodesLinked(first.id, second.id, ['software']);
    const sameSoftware = sharesSoftware(first, second);
    const sameGroup = sameLinkGroup(first, second);
    const sameFamily = sharesCategory(first, second) || first.pole === second.pole;
    const laneGap = Math.abs(categoryLane(first) - categoryLane(second));
    const unrelated = !sameGroup && !directLinked;
    const wanted = 38 + first.radius + second.radius
      + (sameMonth ? 18 : 8)
      + (unrelated ? 22 : 0)
      + (!sameFamily ? clamp(laneGap * 0.12, 8, 24) : 0)
      + (softwareLinked && !directLinked && sameGroup ? 5 : 0)
      - (directLinked ? 16 : 0)
      - (sameSoftware && sameGroup ? 3 : 0);
    if (distance >= wanted) return;

    const push = (wanted - distance) * 0.5;
    const nx = dx / distance;
    const ny = dy / distance;
    const xWeight = unrelated ? 0.72 : 0.5;
    const yWeight = unrelated ? 0.92 : (!sameFamily ? 1.06 : 1.0);
    first.targetX -= nx * push * xWeight;
    first.targetY -= ny * push * yWeight;
    second.targetX += nx * push * xWeight;
    second.targetY += ny * push * yWeight;
  }

  function buildLinkGroups(projectNodes) {
    const visibleIds = new Set(projectNodes.map((node) => node.id));
    const parent = new Map(projectNodes.map((node) => [node.id, node.id]));

    allLinks.forEach((link) => {
      if (link.type !== 'progression' && link.type !== 'exchange') return;
      const sourceId = getLinkEndpointId(link.source);
      const targetId = getLinkEndpointId(link.target);
      if (visibleIds.has(sourceId) && visibleIds.has(targetId)) union(sourceId, targetId);
    });

    const groupsByRoot = new Map();
    projectNodes.forEach((node) => {
      const root = findRoot(node.id);
      if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
      groupsByRoot.get(root).push(node);
    });

    // split by root then by primary theme to create clearer thematic islands
    const groups = [];
    Array.from(groupsByRoot.entries()).forEach(([rootId, nodes]) => {
      const byTheme = nodes.reduce((acc, node) => {
        const theme = primaryTheme(node) || 'other';
        if (!acc[theme]) acc[theme] = [];
        acc[theme].push(node);
        return acc;
      }, {});

      Object.entries(byTheme).forEach(([theme, tnodes]) => {
        groups.push({
          id: `${rootId}::${theme}`,
          nodes: tnodes,
          averageMonth: tnodes.reduce((sum, node) => sum + visibleProjectMonth(node), 0) / tnodes.length,
          averageLane: tnodes.reduce((sum, node) => sum + categoryLane(node), 0) / tnodes.length,
          width: clamp(54 + tnodes.length * 22 + directLinkCount(tnodes) * 3, tnodes.length === 1 ? 46 : 96, 220)
        });
      });
    });

    groups.sort((a, b) => a.averageMonth - b.averageMonth || a.id.localeCompare(b.id));

    const minMonth = Math.min(...projectNodes.map(visibleProjectMonth));
    const maxMonth = Math.max(...projectNodes.map(visibleProjectMonth));
    const monthRange = Math.max(1, maxMonth - minMonth);
    const timelineWidth = clamp(projectNodes.length * 21, 230, 390);

    groups.forEach((group, index) => {
      group.index = index;
      group.centerX = monthRange <= 2
        ? (index / Math.max(1, groups.length - 1) - 0.5) * timelineWidth
        : ((group.averageMonth - minMonth) / monthRange - 0.5) * timelineWidth;
      group.centerY = group.averageLane * 0.16 + Math.sin(index * 1.7) * 24;
    });

    for (let pass = 0; pass < 16; pass += 1) {
      for (let i = 1; i < groups.length; i += 1) {
        const previous = groups[i - 1];
        const group = groups[i];
        const minGap = (previous.width + group.width) / 2 + 14;
        const gap = group.centerX - previous.centerX;
        if (gap < minGap) {
          const push = (minGap - gap) * 0.36;
          previous.centerX -= push;
          group.centerX += push;
        }
      }

      const center = groups.reduce((sum, group) => sum + group.centerX, 0) / groups.length;
      groups.forEach((group) => {
        const chronologicalX = monthRange <= 2
          ? ((group.index / Math.max(1, groups.length - 1)) - 0.5) * timelineWidth
          : ((group.averageMonth - minMonth) / monthRange - 0.5) * timelineWidth;
        group.centerX += (chronologicalX - group.centerX) * 0.16;
        group.centerX -= center * 0.08;
      });
    }

    return groups;

    function findRoot(id) {
      const current = parent.get(id);
      if (current === id) return id;
      const root = findRoot(current);
      parent.set(id, root);
      return root;
    }

    function union(firstId, secondId) {
      const firstRoot = findRoot(firstId);
      const secondRoot = findRoot(secondId);
      if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot);
    }

    function directLinkCount(nodes) {
      const ids = new Set(nodes.map((node) => node.id));
      return allLinks.filter((link) => {
        if (link.type !== 'progression' && link.type !== 'exchange') return false;
        return ids.has(getLinkEndpointId(link.source)) && ids.has(getLinkEndpointId(link.target));
      }).length;
    }
  }

  function sameLinkGroup(first, second) {
    return first.__linkGroup && second.__linkGroup && first.__linkGroup === second.__linkGroup;
  }

  function shouldDisplayVisibleLink(link, sourceNode, targetNode) {
    if (!sourceNode || !targetNode) return false;
    if (link.type === 'progression' || link.type === 'exchange') return true;
    if (link.type !== 'software') return true;

    const targetDistance = Math.hypot(sourceNode.targetX - targetNode.targetX, sourceNode.targetY - targetNode.targetY);
    const sameTheme = primaryTheme(sourceNode) === primaryTheme(targetNode);
    const relatedTheme = categoryAffinity(sourceNode, targetNode) > 0;
    const distanceLimit = sameLinkGroup(sourceNode, targetNode)
      ? 132
      : sameTheme || relatedTheme
        ? 118
        : 86;

    return targetDistance < distanceLimit;
  }

  function attractVisibleTargets(first, second, desired, strength) {
    const dx = second.targetX - first.targetX;
    const dy = second.targetY - first.targetY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance <= desired) return;

    const pull = (distance - desired) * strength;
    const nx = dx / distance;
    const ny = dy / distance;
    first.targetX += nx * pull;
    first.targetY += ny * pull;
    second.targetX -= nx * pull;
    second.targetY -= ny * pull;
  }

  function categoryLane(node) {
    const categories = nodeCategoryKeys(node);
    const has = (key) => categories.includes(key);

    if (has('espace') && has('num')) return 4;
    if (has('espace')) return -54;
    if (has('num') && (has('programmation') || has('web'))) return -84;
    if (has('num') && (has('interactif') || has('scale') || has('live'))) return -42;
    if (has('craft')) return 72;
    if (has('photo') || has('artwork') || has('object')) return 46;
    if (has('num')) return -58;
    if (node.pole === 'digital-pure') return -72;
    if (node.pole === 'digital-space') return 18;
    return 0;
  }

  function primaryTheme(node) {
    const categories = nodeCategoryKeys(node);
    const has = (key) => categories.includes(key);

    if (has('espace') && has('num')) return 'espace-num';
    if (has('espace')) return 'espace';
    if (has('programmation') || has('web')) return 'programmation';
    if (has('interactif') || has('scale') || has('live')) return 'interactif';
    if (has('craft')) return 'craft';
    if (has('photo') || has('artwork') || has('object')) return 'artwork';
    if (has('num')) return 'num';
    return node.pole || 'other';
  }

  function themeRank(node) {
    const ranks = {
      espace: 0,
      'espace-num': 1,
      interactif: 2,
      programmation: 3,
      num: 4,
      craft: 5,
      artwork: 6,
      other: 7
    };
    return ranks[primaryTheme(node)] ?? 7;
  }

  function softwareLaneOffset(node) {
    const tools = nodeToolKeys(node).join(',');
    if (!tools) return 0;
    if (tools.includes('touchdesigner')) return -28;
    if (tools.includes('programmation') || tools.includes('programming')) return -18;
    if (tools.includes('blender') || tools.includes('rhino') || tools.includes('autocad')) return 18;
    if (tools.includes('craft')) return 24;
    if (tools.includes('indesign')) return 8;
    if (tools.includes('art') || tools.includes('photo')) return 14;
    return 0;
  }

  function nodeToolKeys(node) {
    if (Array.isArray(node.toolKeys)) return node.toolKeys;
    return (node.tools || []).map(normalizeToken).filter(Boolean);
  }

  function nodeCategoryKeys(node) {
    if (Array.isArray(node.categoryKeys)) return node.categoryKeys;
    return String(node.category || '')
      .split(',')
      .map(normalizeToken)
      .filter(Boolean);
  }

  function sharesSoftware(first, second) {
    const secondTools = new Set(nodeToolKeys(second));
    return nodeToolKeys(first).some((tool) => secondTools.has(tool));
  }

  function sharesCategory(first, second) {
    return categoryAffinity(first, second) > 0;
  }

  function categoryAffinity(first, second) {
    const secondCategories = new Set(nodeCategoryKeys(second));
    return nodeCategoryKeys(first)
      .filter((category) => secondCategories.has(category))
      .length;
  }

  function fitGraph(ms) {
    window.requestAnimationFrame(() => {
      if (!graph) return;
      const visibleProjects = graph.graphData().nodes.filter((node) => node.type === 'project');
      const bounds = visibleProjects.length ? getNodeBounds(visibleProjects) : layoutBounds;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      graph.centerAt(centerX, centerY, ms);
      graph.zoom(zoomForBounds(bounds), ms);
    });
  }

  function graphPadding() {
    return Math.max(150, Math.min(graphEl.clientWidth, graphEl.clientHeight) * 0.24);
  }

  function zoomForBounds(bounds) {
    const padding = graphPadding();
    const width = Math.max(1, bounds.maxX - bounds.minX + 32);
    const height = Math.max(1, bounds.maxY - bounds.minY + 32);
    const availableWidth = Math.max(1, graphEl.clientWidth - padding * 2);
    const availableHeight = Math.max(1, graphEl.clientHeight - padding * 2);
    return clamp(Math.min(availableWidth / width, availableHeight / height), 0.75, 2.2);
  }

  function drawNode(node, ctx, globalScale) {
    if (node.hidden) return;

    const tone = nodeTone(node.month);
    const exitProgress = getExitProgress(node);
    const radius = node.radius * (1 - exitProgress * 0.58) / Math.sqrt(globalScale);

    ctx.save();
    ctx.globalAlpha = tone.alpha * (1 - exitProgress * 0.32);
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${tone.value}, ${tone.value}, ${tone.value})`;
    ctx.fill();
    ctx.restore();
  }

  function drawLink(link, ctx, globalScale) {
    if (!isLinkVisible(link)) return;

    const sourceNode = typeof link.source === 'object' ? link.source : nodeById(link.source);
    const targetNode = typeof link.target === 'object' ? link.target : nodeById(link.target);
    if (!sourceNode || !targetNode) return;

    const tone = linkTone(link.month);
    const isExchange = link.type === 'exchange';
    const isSoftware = link.type === 'software';
    const exitProgress = Math.max(getExitProgress(sourceNode), getExitProgress(targetNode));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sourceNode.x, sourceNode.y);
    if (isSoftware) {
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.setLineDash([2.5 / globalScale, 5.5 / globalScale]);
    } else {
      ctx.lineTo(targetNode.x, targetNode.y);
      if (isExchange) ctx.setLineDash([4 / globalScale, 6 / globalScale]);
    }
    const softwareWeight = isSoftware ? clamp(0.82 + (link.strength || 0.42), 0.86, 1.28) : 1;
    ctx.lineWidth = ((isSoftware ? 0.56 : isExchange ? 0.44 : 0.9) * tone.weight * softwareWeight) / globalScale;
    ctx.strokeStyle = `rgba(${tone.value}, ${tone.value}, ${tone.value}, ${tone.alpha * (isSoftware ? 0.58 : isExchange ? 0.34 : 0.92) * (1 - exitProgress * 0.4)})`;
    ctx.stroke();
    ctx.restore();
  }

  function paintPointerArea(node, color, ctx, globalScale) {
    if (node.type !== 'project') return;
    const radius = Math.max(7, node.radius / Math.sqrt(globalScale));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function updateTimeline() {
    const range = Math.max(1, endMonth - startMonth);
    const handleRatio = (visibleStartMonth - startMonth) / range;

    if (handleEl) {
      handleEl.style.left = `${handleRatio * 100}%`;
      handleEl.textContent = String(Math.floor(visibleStartMonth / 12));
    }

    timelineEl.querySelectorAll('.archive-tick').forEach((tick) => {
      const month = Number(tick.dataset.month);
      tick.classList.toggle('is-visible', month >= visibleStartMonth);
      tick.classList.toggle('is-start', month === visibleStartMonth);
    });

    timelineEl.querySelectorAll('.archive-year-labels button').forEach((label) => {
      const year = Number(label.dataset.year);
      label.classList.toggle('is-visible', year * 12 >= visibleStartMonth);
      label.classList.toggle('is-start', year === Math.floor(visibleStartMonth / 12));
    });

    if (currentYearEl) currentYearEl.textContent = '2026';
  }

  function updateStatus(nodeCount, linkCount) {
    if (!statusEl) return;
    lastNodeCount = nodeCount;
    lastLinkCount = linkCount;
    statusEl.textContent = window.PortfolioI18n?.t('archiveStatus', {
      period: tickLabel(visibleStartMonth),
      year: '2026',
      nodeCount,
      linkCount
    }) || `${tickLabel(visibleStartMonth)} - 2026 / ${nodeCount} points / ${linkCount} links`;
  }

  function refreshArchiveLabels() {
    if (handleEl) {
      handleEl.setAttribute('aria-label', window.PortfolioI18n?.t('archiveRangeHandleLabel') || 'Start of visible archive range');
    }

    if (statusEl) {
      updateStatus(lastNodeCount, lastLinkCount);
    }
  }

  function startDrag(event) {
    if (!handleEl) return;
    isDragging = true;
    handleEl.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
    handleEl.addEventListener('pointermove', drag);
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);
  }

  function drag(event) {
    if (!isDragging) return;
    updateFromPointer(event.clientX);
  }

  function endDrag(event) {
    isDragging = false;
    if (handleEl && handleEl.hasPointerCapture(event.pointerId)) {
      handleEl.releasePointerCapture(event.pointerId);
    }
    handleEl.removeEventListener('pointermove', drag);
    handleEl.removeEventListener('pointerup', endDrag);
    handleEl.removeEventListener('pointercancel', endDrag);
  }

  function updateFromPointer(clientX) {
    const ticks = timelineEl.querySelector('.archive-ticks');
    const rect = ticks.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const month = startMonth + Math.round(ratio * (totalMonths - 1));
    setVisibleStart(month, true);
  }

  function isProjectVisible(node) {
    if (node.type !== 'project') return false;
    return isMonthInVisibleRange(projectMonth(node)) || isMonthInVisibleRange(projectEndMonth(node));
  }

  function isNodeVisible(node) {
    return (isMonthInVisibleRange(projectMonth(node)) || isMonthInVisibleRange(projectEndMonth(node))) || node.__exiting;
  }

  function isLinkVisible(link) {
    const sourceNode = typeof link.source === 'object' ? link.source : nodeById(link.source);
    const targetNode = typeof link.target === 'object' ? link.target : nodeById(link.target);
    return sourceNode && targetNode && isNodeVisible(sourceNode) && isNodeVisible(targetNode);
  }

  function nodeById(id) {
    return allNodes.find((node) => node.id === id);
  }

  function nodeTone(month) {
    const year = Math.floor(month / 12);
    const age = clamp((year - source.startYear) / Math.max(1, source.endYear - source.startYear), 0, 1);
    const value = Math.round(174 - age * 174);
    return {
      value,
      alpha: 0.68 + age * 0.32,
      weight: 1.28 - age * 0.28
    };
  }

  function linkTone(month) {
    const tone = nodeTone(month);
    return {
      value: Math.min(214, tone.value + 12),
      alpha: Math.max(0.76, tone.alpha),
      weight: Math.max(1.12, tone.weight)
    };
  }

  function applyLocalDragInfluence(draggedNode, dx, dy) {
    if (!graph) return;

    const nodes = graph.graphData().nodes;
    nodes.forEach((node) => {
      if (node === draggedNode || node.type !== 'project' || node.hidden) return;

      const linked = areNodesLinked(draggedNode.id, node.id);
      const maxDistance = linked ? dragInfluenceRadius * 1.45 : dragInfluenceRadius;
      const distance = Math.hypot(node.x - draggedNode.x, node.y - draggedNode.y);
      if (distance > maxDistance) return;

      const falloff = 1 - distance / maxDistance;
      const influence = falloff * falloff * dragInfluenceStrength * (linked ? 1.38 : 1);
      const moveX = dx * influence;
      const moveY = dy * influence;

      node.x += moveX;
      node.y += moveY;
      node.vx = (node.vx || 0) + moveX * 0.08;
      node.vy = (node.vy || 0) + moveY * 0.08;
      node.targetX += moveX * 0.46;
      node.targetY += moveY * 0.46;
    });

    graph.d3ReheatSimulation();
  }

  function areNodesLinked(firstId, secondId, types) {
    return allLinks.some((link) => {
      if (Array.isArray(types) && !types.includes(link.type)) return false;
      const sourceId = getLinkEndpointId(link.source);
      const targetId = getLinkEndpointId(link.target);
      return (sourceId === firstId && targetId === secondId) || (sourceId === secondId && targetId === firstId);
    });
  }

  function getLinkEndpointId(endpoint) {
    return typeof endpoint === 'object' ? endpoint.id : endpoint;
  }

  function prepareNodeForDynamicEntry(node, currentIds, currentNodes) {
    if (currentIds.has(node.id)) return;

    const neighbor = findVisibleNeighbor(node, currentNodes);
    if (neighbor) {
      node.x = neighbor.x;
      node.y = neighbor.y;
    } else {
      node.x = node.targetX;
      node.y = node.targetY;
    }
  }

  function resetNodeExit(node) {
    if (!node.__exiting) return;
    node.__exiting = false;
    node.__exitComplete = false;
    delete node.__exitStarted;
    delete node.__exitDuration;
    const timer = exitTimers.get(node.id);
    if (timer) window.clearTimeout(timer);
    exitTimers.delete(node.id);
  }

  function startNodeExit(node, projectNodes, currentNodes) {
    if (!node.__exiting) {
      node.__exiting = true;
      node.__exitStarted = performance.now();
      node.__exitDuration = exitDuration;

      const exitTarget = findExitTarget(node, projectNodes, currentNodes);
      if (exitTarget) {
        node.targetX = exitTarget.x;
        node.targetY = exitTarget.y;
      }
    }

    const existingTimer = exitTimers.get(node.id);
    if (existingTimer) window.clearTimeout(existingTimer);

    const timer = window.setTimeout(() => {
      node.__exiting = false;
      node.__exitComplete = true;
      delete node.__exitStarted;
      delete node.__exitDuration;
      exitTimers.delete(node.id);
      if (graph) {
        setVisibleStart(visibleStartMonth, false);
      }
    }, exitDuration);

    exitTimers.set(node.id, timer);
    return node;
  }

  function clearStaleExits() {
    const now = performance.now();
    exitTimers.forEach((timer, id) => {
      const node = allNodes.find((project) => project.id === id);
      if (!node || !node.__exitStarted || now - node.__exitStarted > exitDuration + 80) {
        window.clearTimeout(timer);
        exitTimers.delete(id);
        if (node) {
          node.__exiting = false;
          node.__exitComplete = true;
          delete node.__exitStarted;
          delete node.__exitDuration;
        }
      }
    });
  }

  function findExitTarget(node, projectNodes, currentNodes) {
    const candidates = [...projectNodes, ...currentNodes.filter((currentNode) => currentNode.type === 'project' && !currentNode.__exiting)];
    const linked = candidates.find((candidate) => candidate.id !== node.id && areNodesLinked(candidate.id, node.id));
    if (linked) return linked;

    return candidates
      .filter((candidate) => candidate.id !== node.id)
      .sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y))[0] || null;
  }

  function getExitProgress(node) {
    if (!node.__exiting || !node.__exitStarted) return 0;
    return clamp((performance.now() - node.__exitStarted) / (node.__exitDuration || exitDuration), 0, 1);
  }

  function findVisibleNeighbor(node, currentNodes) {
    const currentById = new Map(currentNodes.map((currentNode) => [currentNode.id, currentNode]));
    const relatedLink = allLinks.find((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return (sourceId === node.id && currentById.has(targetId)) || (targetId === node.id && currentById.has(sourceId));
    });

    if (!relatedLink) return null;

    const sourceId = typeof relatedLink.source === 'object' ? relatedLink.source.id : relatedLink.source;
    const targetId = typeof relatedLink.target === 'object' ? relatedLink.target.id : relatedLink.target;
    return currentById.get(sourceId === node.id ? targetId : sourceId);
  }

  function layoutForce(alpha) {
    const nodes = graph ? graph.graphData().nodes : [];
    const projectNodes = nodes.filter((node) => node.type === 'project' && !node.hidden);

    for (let i = 0; i < projectNodes.length; i += 1) {
      for (let j = i + 1; j < projectNodes.length; j += 1) {
        applyRuntimeRepulsion(projectNodes[i], projectNodes[j], alpha);
        const affinity = categoryAffinity(projectNodes[i], projectNodes[j]);
        if (affinity && sameLinkGroup(projectNodes[i], projectNodes[j])) {
          applyRuntimeAttraction(projectNodes[i], projectNodes[j], 84 - affinity * 4, alpha, 0.0015 + affinity * 0.0006);
        }
      }
    }

    const nodeMap = new Map(projectNodes.map((node) => [node.id, node]));
    (graph ? graph.graphData().links : []).forEach((link) => {
      const source = nodeMap.get(getLinkEndpointId(link.source));
      const target = nodeMap.get(getLinkEndpointId(link.target));
      if (!source || !target) return;
      if (link.type === 'software') {
        if (sameLinkGroup(source, target)) applyRuntimeAttraction(source, target, 120, alpha, 0.002 * (link.strength || 0.42));
      } else if (link.type === 'progression' || link.type === 'exchange') {
        const sameGroup = sameLinkGroup(source, target);
        applyRuntimeAttraction(source, target, sameGroup ? 66 : 112, alpha, sameGroup ? 0.012 : 0.003);
      }
    });

    nodes.forEach((node) => {
      if (node.hidden || node.__dragging) return;
      const pull = node.type === 'project' ? 0.18 : 0.22;
      node.vx = (node.vx || 0) + (node.targetX - node.x) * alpha * pull;
      node.vy = (node.vy || 0) + (node.targetY - node.y) * alpha * pull;
    });
  }

  function applyRuntimeRepulsion(first, second, alpha) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const sameYear = Math.floor(first.month / 12) === Math.floor(second.month / 12);
    const directLinked = areNodesLinked(first.id, second.id, ['progression', 'exchange']);
    const softwareLinked = areNodesLinked(first.id, second.id, ['software']);
    const sameSoftware = sharesSoftware(first, second);
    const affinity = categoryAffinity(first, second);
    const sameGroup = sameLinkGroup(first, second);
    const sameFamily = affinity > 0 || first.pole === second.pole;
    const differentLane = Math.abs(categoryLane(first) - categoryLane(second));
    const unrelated = !sameGroup && !directLinked;
    const wanted = 32 + first.radius + second.radius
      + (sameYear ? 14 : 6)
      + (unrelated ? 18 : 0)
      + (!sameFamily ? clamp(differentLane * 0.12, 8, 26) : 0)
      + (softwareLinked && !directLinked && sameGroup ? 5 : 0)
      - (directLinked ? 12 : 0)
      - (sameSoftware && sameGroup ? 3 : 0)
      - (affinity && sameGroup ? affinity * 3 : 0);
    if (distance >= wanted) return;

    const force = (wanted - distance) * alpha * (unrelated ? 0.13 : 0.11);
    const nx = dx / distance;
    const ny = dy / distance;
    const xWeight = unrelated ? 0.76 : 0.68;
    const yWeight = unrelated ? 0.9 : (!sameFamily ? 1.02 : 0.96);

    if (!first.__dragging) {
      first.vx = (first.vx || 0) - nx * force * xWeight;
      first.vy = (first.vy || 0) - ny * force * yWeight;
    }
    if (!second.__dragging) {
      second.vx = (second.vx || 0) + nx * force * xWeight;
      second.vy = (second.vy || 0) + ny * force * yWeight;
    }
  }

  function applyRuntimeAttraction(first, second, desired, alpha, strength) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance <= desired) return;

    const pull = (distance - desired) * alpha * strength;
    const nx = dx / distance;
    const ny = dy / distance;

    if (!first.__dragging) {
      first.vx = (first.vx || 0) + nx * pull;
      first.vy = (first.vy || 0) + ny * pull;
    }
    if (!second.__dragging) {
      second.vx = (second.vx || 0) - nx * pull;
      second.vy = (second.vy || 0) - ny * pull;
    }
  }

  function projectMonth(project) {
    const startDate = project.startDate || {};
    return (startDate.year || project.year) * 12 + ((startDate.month || 1) - 1);
  }

  function projectEndMonth(project) {
    const endDate = project.endDate || project.startDate || {};
    const start = projectMonth(project);
    const end = (endDate.year || project.year) * 12 + ((endDate.month || 1) - 1);
    return Math.max(start, end);
  }

  function visibleProjectMonth(project) {
    const start = projectMonth(project);
    const finish = projectEndMonth(project);
    if (isMonthInVisibleRange(start)) return start;
    if (isMonthInVisibleRange(finish)) return finish;
    return start;
  }

  function isMonthInVisibleRange(month) {
    return month >= visibleStartMonth && month <= endMonth;
  }

  function linkControlPoint(sourceNode, targetNode, curve) {
    const midX = (sourceNode.x + targetNode.x) / 2;
    const midY = (sourceNode.y + targetNode.y) / 2;
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const offset = length * curve;

    return {
      x: midX - (dy / length) * offset,
      y: midY + (dx / length) * offset
    };
  }

  function fallbackPosition(month, index) {
    const yearRatio = (month - startMonth) / Math.max(1, endMonth - startMonth);
    return {
      x: (yearRatio - 0.5) * 280 + Math.sin(index * 1.8) * 18,
      y: Math.cos(index * 1.16) * 92
    };
  }

  function getNodeBounds(nodes) {
    return nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.targetX),
      maxX: Math.max(acc.maxX, node.targetX),
      minY: Math.min(acc.minY, node.targetY),
      maxY: Math.max(acc.maxY, node.targetY)
    }), {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
  }

  function tickLabel(month) {
    return String(Math.floor(month / 12));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeToken(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  }
}());
