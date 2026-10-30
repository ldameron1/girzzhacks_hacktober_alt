export class GameHUD {
  private deathsElem: HTMLElement;
  private coinsElem: HTMLElement;
  private progressElem: HTMLElement;
  private brutalityElem: HTMLElement;
  private rageBarElem: HTMLElement;
  private botBadgeElem: HTMLElement;
  private mutationsElem: HTMLElement;

  constructor() {
    this.deathsElem = document.getElementById('hud-deaths')!;
    this.coinsElem = document.getElementById('hud-coins')!;
    this.progressElem = document.getElementById('hud-progress')!;
    this.brutalityElem = document.getElementById('hud-brutality')!;
    this.rageBarElem = document.getElementById('hud-rage-fill')!;
    this.botBadgeElem = document.getElementById('hud-bot-badge')!;
    this.mutationsElem = document.getElementById('hud-mutations')!;
  }

  update(deaths: number, coins: number, furthestX: number, brutality: number, botActive: boolean, totalMutations: number = 0) {
    if (this.deathsElem) this.deathsElem.textContent = `${deaths}`;
    if (this.coinsElem) this.coinsElem.textContent = `${coins}`;

    const percent = Math.min(100, Math.round((furthestX / (110 * 32)) * 100));
    if (this.progressElem) this.progressElem.textContent = `${percent}%`;

    if (this.brutalityElem) {
      this.brutalityElem.textContent = `TIER ${brutality}/10`;
      this.brutalityElem.style.color = brutality > 7 ? '#ef4444' : (brutality > 4 ? '#f59e0b' : '#10b981');
    }

    if (this.rageBarElem) {
      const rage = Math.min(100, deaths * 12);
      this.rageBarElem.style.width = `${rage}%`;
    }

    if (this.botBadgeElem) {
      this.botBadgeElem.textContent = botActive ? '🤖 AI BOT DRIVER' : '🎮 HUMAN PLAYER';
      this.botBadgeElem.className = botActive ? 'badge bot-active' : 'badge human-active';
    }

    if (this.mutationsElem) {
      this.mutationsElem.textContent = `${totalMutations}`;
    }
  }
}
