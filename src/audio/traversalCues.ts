import type { PlayerSystem } from '../game/contracts';

export type TraversalCue = 'cast' | 'attach' | 'release' | 'pull' | 'boost';
type PlayerAudioState = Pick<PlayerSystem, 'mode' | 'skyLance' | 'airBoost'>;

/** Read presentation state only. No polling geometry, loops, or gameplay mutations. */
export class TraversalCues {
  private equipment: PlayerAudioState['skyLance'];
  private initialized = false;
  private projectile = false;
  private attached = false;
  private pulling = false;
  private boosting = false;

  update(player: PlayerAudioState, active: boolean, emit: (cue: TraversalCue) => void): void {
    const lance = player.skyLance;
    const projectile = lance?.state === 'projectile';
    const attached = !!lance?.rope;
    const pulling = attached && (lance?.pullTime ?? 0) > 0;
    const boosting = (player.airBoost?.remaining ?? 0) > 0;
    const free = player.mode === 'onFoot' || player.mode === 'traversing' || player.mode === 'falling';
    if (this.initialized && lance === this.equipment && lance && active && free) {
      if (projectile && !this.projectile) emit('cast');
      if (attached && !this.attached) emit('attach');
      // Mount, respawn and equipment resets are silent; actual detachments enter 'spent'.
      if (!attached && this.attached && lance.state === 'spent') emit('release');
      if (pulling && !this.pulling) emit('pull');
      if (boosting && !this.boosting) emit('boost');
    }
    this.initialized = true;
    this.equipment = lance;
    this.projectile = projectile;
    this.attached = attached;
    this.pulling = pulling;
    this.boosting = boosting;
  }
}
