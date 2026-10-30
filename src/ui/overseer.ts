export class OverseerTerminal {
  private tauntElem: HTMLElement;
  private archetypeElem: HTMLElement;
  private diagnosisElem: HTMLElement;
  private mutationsListElem: HTMLElement;
  private fairnessElem: HTMLElement;
  private modelIndicatorElem: HTMLElement;
  private latencyElem: HTMLElement;

  private typewriterInterval: number | null = null;

  constructor() {
    this.tauntElem = document.getElementById('overseer-taunt')!;
    this.archetypeElem = document.getElementById('overseer-archetype')!;
    this.diagnosisElem = document.getElementById('overseer-diagnosis')!;
    this.mutationsListElem = document.getElementById('overseer-mutations')!;
    this.fairnessElem = document.getElementById('overseer-fairness')!;
    this.modelIndicatorElem = document.getElementById('overseer-model')!;
    this.latencyElem = document.getElementById('overseer-latency')!;
  }

  displayGemmaResponse(data: any) {
    if (this.archetypeElem) {
      this.archetypeElem.textContent = data.playerArchetype || 'Subject Identified';
    }

    if (this.diagnosisElem) {
      this.diagnosisElem.textContent = data.diagnosis || 'Locomotion heuristics audited.';
    }

    if (this.fairnessElem) {
      this.fairnessElem.textContent = `✓ ${data.fairnessAudit || 'Mathematically verified beatable.'}`;
    }

    if (this.modelIndicatorElem) {
      this.modelIndicatorElem.textContent = data.modelUsed || 'Gemma 4';
    }

    if (this.latencyElem) {
      this.latencyElem.textContent = `${data.latencyMs || 0}ms`;
    }

    // Typewriter effect for sarcastic taunt
    if (this.tauntElem && data.taunt) {
      this.typewriteText(`"${data.taunt}"`);
    }

    // Render list of deployed Kaizo mutations
    if (this.mutationsListElem && data.mutations && Array.isArray(data.mutations)) {
      this.mutationsListElem.innerHTML = '';
      data.mutations.forEach((m: any) => {
        const item = document.createElement('div');
        item.className = 'mutation-badge';
        item.innerHTML = `
          <span class="m-type">[${m.type}]</span>
          <span class="m-pos">@ (${m.x}, ${m.y})</span>
          <span class="m-desc">${m.justification}</span>
        `;
        this.mutationsListElem.appendChild(item);
      });
    }
  }

  private typewriteText(text: string) {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
    }
    this.tauntElem.textContent = '';
    let idx = 0;
    this.typewriterInterval = window.setInterval(() => {
      if (idx < text.length) {
        this.tauntElem.textContent += text.charAt(idx);
        idx++;
      } else {
        clearInterval(this.typewriterInterval!);
        this.typewriterInterval = null;
      }
    }, 28);
  }
}
