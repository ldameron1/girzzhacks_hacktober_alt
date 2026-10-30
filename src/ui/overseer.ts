export class OverseerTerminal {
  private static readonly HISTORY_KEY = 'gemmakaizo-request-feed';
  private static readonly MAX_HISTORY = 12;
  private archetypeElem: HTMLElement;
  private diagnosisElem: HTMLElement;
  private mutationsListElem: HTMLElement;
  private fairnessElem: HTMLElement;
  private modelIndicatorElem: HTMLElement;
  private latencyElem: HTMLElement;
  private requestFeedElem: HTMLElement;
  private feedStatusElem: HTMLElement;
  private liveStreamElem: HTMLElement;
  private apiMonitorLines: HTMLElement;
  private apiMonitorStatus: HTMLElement;
  private proofChainElem: HTMLElement;
  private responseBlurbElem: HTMLElement;
  private responseStateElem: HTMLElement;

  constructor() {
    this.archetypeElem = document.getElementById('overseer-archetype')!;
    this.diagnosisElem = document.getElementById('overseer-diagnosis')!;
    this.mutationsListElem = document.getElementById('overseer-mutations')!;
    this.fairnessElem = document.getElementById('overseer-fairness')!;
    this.modelIndicatorElem = document.getElementById('overseer-model')!;
    this.latencyElem = document.getElementById('overseer-latency')!;
    this.requestFeedElem = document.getElementById('overseer-request-feed')!;
    this.feedStatusElem = document.getElementById('overseer-feed-status')!;
    this.liveStreamElem = document.getElementById('overseer-live-stream')!;
    this.apiMonitorLines = document.getElementById('api-monitor-lines')!;
    this.apiMonitorStatus = document.getElementById('api-monitor-status')!;
    this.proofChainElem = document.getElementById('overseer-proof-chain')!;
    this.responseBlurbElem = document.getElementById('overseer-response-blurb')!;
    this.responseStateElem = document.getElementById('overseer-response-state')!;
    this.renderRequestHistory();
  }

  updateApiMonitor(entry: any) {
    if (!this.apiMonitorLines) return;
    const line = document.createElement('div');
    const status = String(entry.status || 'sent');
    const isResponse = entry.kind === 'mutation-response';
    line.className = `api-line ${status.includes('fallback') ? 'warn' : isResponse ? 'response' : 'request'}`;
    const time = new Date(entry.receivedAt || Date.now()).toLocaleTimeString();
    const label = isResponse ? '← RESPONSE' : '→ POST /api/mutate';
    const detail = isResponse
      ? `${entry.response?.modelUsed || 'model'} · ${entry.response?.mutations?.length || 0} accepted · ${entry.response?.rejectedMutations?.length || 0} rejected`
      : `telemetry · ${entry.request?.telemetry?.totalDeaths || 0} deaths`;
    line.textContent = `${time}  ${label}  ${detail}`;
    this.apiMonitorLines.prepend(line);
    while (this.apiMonitorLines.children.length > 4) {
      this.apiMonitorLines.lastElementChild?.remove();
    }
    if (this.apiMonitorStatus) {
      this.apiMonitorStatus.textContent = status.toUpperCase();
      this.apiMonitorStatus.className = status.includes('fallback') ? 'monitor-warn' : 'monitor-live';
    }
  }

  updateProofChain(step: 'telemetry' | 'request' | 'validated' | 'applied' | 'retry' | 'fallback', detail?: string) {
    if (!this.proofChainElem) return;
    const steps = Array.from(this.proofChainElem.querySelectorAll<HTMLElement>('.proof-step'));
    const labels = ['telemetry', 'request', 'validated', 'applied'];
    const activeIndex = step === 'retry' ? 1 : step === 'fallback' ? 2 : labels.indexOf(step);
    steps.forEach((item, index) => {
      item.classList.toggle('complete', index < activeIndex || (step === 'applied' && index === activeIndex));
      item.classList.toggle('active', index === activeIndex && step !== 'applied');
      if (index === activeIndex && detail) {
        const small = item.querySelector('small');
        if (small) small.textContent = detail;
      }
      const mark = item.querySelector('.proof-mark');
      if (mark) mark.textContent = index < activeIndex || (step === 'applied' && index === activeIndex) ? '✓' : index === activeIndex ? '●' : '○';
    });
    if (step === 'retry') {
      const small = steps[1]?.querySelector('small');
      if (small) small.textContent = detail || 'Retrying once after API failure';
    }
    if (step === 'fallback') {
      const small = steps[2]?.querySelector('small');
      if (small) small.textContent = detail || 'No validated response; fallback reported';
    }
  }

  updateTelemetryStream(telemetry: any) {
    if (!this.liveStreamElem) return;
    const now = new Date().toLocaleTimeString();
    const lines = [
      `telemetry ${now} · x=${Math.round(telemetry.furthestX || 0)} · deaths=${telemetry.totalDeaths || 0}`,
      `behavior scan · speed=${Number(telemetry.averageSpeed || 0).toFixed(1)} · jumps=${telemetry.jumpCount || 0}`
    ];
    this.liveStreamElem.replaceChildren(...lines.map((line) => {
      const item = document.createElement('div');
      item.className = 'stream-line';
      item.innerHTML = '<span class="stream-dot"></span>';
      item.append(document.createTextNode(` ${line}`));
      return item;
    }));
  }

  recordRequest(entry: any) {
    const history = this.readHistory();
    history.unshift(entry);
    try {
      localStorage.setItem(OverseerTerminal.HISTORY_KEY, JSON.stringify(history.slice(0, OverseerTerminal.MAX_HISTORY)));
    } catch {
      // The feed is diagnostic only; gameplay should continue if storage is unavailable.
    }
    this.renderRequestHistory();
  }

  private readHistory(): any[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(OverseerTerminal.HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private renderRequestHistory() {
    if (!this.requestFeedElem) return;
    const history = this.readHistory().slice(0, 5);
    this.requestFeedElem.replaceChildren();
    if (!history.length) {
      this.requestFeedElem.innerHTML = '<div class="feed-empty">Death-triggered mutation requests will appear here.</div>';
      return;
    }
    history.forEach((entry) => {
      const item = document.createElement('details');
      item.className = 'request-entry';
      const summary = document.createElement('summary');
      const status = entry.status || 'sent';
      summary.textContent = `${status.toUpperCase()} · ${entry.kind || 'mutation'} · ${new Date(entry.receivedAt || Date.now()).toLocaleTimeString()}`;
      item.appendChild(summary);
      const raw = document.createElement('pre');
      raw.textContent = JSON.stringify(entry, null, 2);
      item.appendChild(raw);
      this.requestFeedElem.appendChild(item);
    });
    if (this.feedStatusElem) {
      this.feedStatusElem.textContent = history[0]?.status === 'offline-fallback' ? 'FALLBACK' : 'LIVE';
      this.feedStatusElem.className = `feed-status ${history[0]?.status === 'offline-fallback' ? 'fallback' : 'live'}`;
    }
  }

  displayGemmaResponse(data: any) {
    const acceptedCount = Array.isArray(data.mutations) ? data.mutations.length : 0;
    const rejectedCount = Array.isArray(data.rejectedMutations) ? data.rejectedMutations.length : 0;
    const fallbackUsed = data.fallbackUsed === true
      || /heuristic|offline|fallback/i.test(String(data.modelUsed || ''));
    const diagnosis = this.truncate(String(data.diagnosis || data.rationale || ''));

    if (this.archetypeElem) {
      this.archetypeElem.textContent = data.playerArchetype || 'Subject Identified';
    }

    if (this.diagnosisElem) {
      this.diagnosisElem.textContent = diagnosis;
    }

    if (this.fairnessElem) {
      const patchStatus = data.patchedLevel ? 'level patch applied' : 'no level patch returned';
      this.fairnessElem.textContent =
        `Model estimate: ${data.fairnessAudit || 'No audit returned.'} ` +
        `(${rejectedCount} rejected; ${patchStatus})`;
    }

    if (this.modelIndicatorElem) {
      this.modelIndicatorElem.textContent = data.modelUsed || 'Gemma 4';
    }

    if (this.latencyElem) {
      this.latencyElem.textContent = Number.isFinite(Number(data.latencyMs))
        ? `${Math.max(0, Math.round(Number(data.latencyMs)))}ms`
        : '—';
    }

    if (this.responseBlurbElem) {
      this.responseBlurbElem.textContent =
        `${
          [diagnosis, String(data.modelUsed || 'Provider not reported'),
          Number.isFinite(Number(data.latencyMs)) ? `${Math.max(0, Math.round(Number(data.latencyMs)))}ms` : 'latency not reported',
          `${acceptedCount} accepted / ${rejectedCount} rejected`]
            .filter(Boolean).join(' · ')
        } · fallback ${fallbackUsed ? 'used' : 'not used'}`;
    }

    if (this.responseStateElem) {
      this.responseStateElem.textContent = fallbackUsed ? 'FALLBACK' : 'LIVE MODEL';
      this.responseStateElem.className = `response-state ${fallbackUsed ? 'fallback' : 'live'}`;
    }

    // Render list of deployed Kaizo mutations
    if (this.mutationsListElem && data.mutations && Array.isArray(data.mutations)) {
      this.mutationsListElem.innerHTML = '';
      data.mutations.forEach((m: any) => {
        const item = document.createElement('div');
        item.className = 'mutation-badge';
        const type = document.createElement('span');
        type.className = 'm-type';
        type.textContent = `[${m.type}]`;
        const position = document.createElement('span');
        position.className = 'm-pos';
        position.textContent = `@ (${m.x}, ${m.y})`;
        const description = document.createElement('span');
        description.className = 'm-desc';
        description.textContent = m.justification || 'Accepted by level patcher.';
        item.append(type, position, description);
        this.mutationsListElem.appendChild(item);
      });

      const rejected = Array.isArray(data.rejectedMutations) ? data.rejectedMutations : [];
      rejected.forEach((m: any) => {
        const item = document.createElement('div');
        item.className = 'mutation-badge rejected';
        item.textContent = `[REJECTED] ${m.type || 'mutation'} @ (${m.x ?? '?'}, ${m.y ?? '?'}) — ${m.reason || m.justification || 'Rejected by level patcher.'}`;
        this.mutationsListElem.appendChild(item);
      });
    }
  }

  private truncate(value: string, maxLength = 150): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
  }
}
