export interface HudRect { left: number; top: number; right: number; bottom: number }

const GAP = 10, MARGIN = 14;
export function overlaps(a: HudRect, b: HudRect, gap = GAP): boolean {
  return a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
}

/** Put a secondary panel in an unoccupied edge slot, keeping the centre clear. */
export function edgeSlot(width: number, height: number, panelWidth: number, panelHeight: number, occupied: readonly HudRect[]): HudRect | null {
  const centre = { left: width * .35, right: width * .65, top: height * .25, bottom: height * .75 };
  const xs = [width - MARGIN - panelWidth, MARGIN];
  const ys = [height - MARGIN - panelHeight, MARGIN,
    ...occupied.flatMap(r => [r.top - GAP - panelHeight, r.bottom + GAP])];
  for (const x of xs) for (const y of ys) {
    const rect = { left: x, top: y, right: x + panelWidth, bottom: y + panelHeight };
    if (x < MARGIN || y < MARGIN || rect.right > width - MARGIN || rect.bottom > height - MARGIN) continue;
    if (!overlaps(rect, centre, 0) && !occupied.some(r => overlaps(rect, r))) return rect;
  }
  return null;
}

// Measure the painted children: absolute notes extend beyond the flight-info parent.
const BLOCKERS = '.dw-readouts,.dw-gauge,.dw-flightinfo-notes,.dw-compass,.dw-compass-labels,.dw-prompt,.dw-tip,.dw-toasts,.dw-banner,.dw-stall,.dw-pointer-hint,.dw-race,.dw-gate,.dw-countdown,.dw-missed,.dw-edge';
const layouts = new WeakMap<HTMLElement, string>();
const checks = new WeakMap<HTMLElement, { signature: string; next: number }>();
function painted(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || style.display === 'none' || style.visibility === 'hidden' ||
        (Number(style.opacity) < .01 && !node.classList.contains('is-on'))) return false;
  }
  return el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
}

/** Reserve the discovery band's declared visual overflow, clipped by the UI viewport.
 * Its two untransformed absolute pseudo-elements extend beyond the text box. */
function paintedBounds(el: HTMLElement): HudRect {
  const box = el.getBoundingClientRect();
  let left=box.left,top=box.top,right=box.right,bottom=box.bottom;
  if(el.classList.contains('dw-banner'))for(const pseudo of ['::before','::after']){
    const style=getComputedStyle(el,pseudo);
    if(style.content==='none'||style.content==='normal'||style.display==='none')continue;
    const x=parseFloat(style.left),y=parseFloat(style.top),width=parseFloat(style.width),height=parseFloat(style.height);
    if(![x,y,width,height].every(Number.isFinite))continue;
    left=Math.min(left,box.left+x);top=Math.min(top,box.top+y);
    right=Math.max(right,box.left+x+width);bottom=Math.max(bottom,box.top+y+height);
  }
  return {left:Math.max(0,left),top:Math.max(0,top),right:Math.min(innerWidth,right),bottom:Math.min(innerHeight,bottom)};
}

/** No gameplay queries. Called after the existing HUD has updated its visibility. */
export function placeWindlinePanel(panel: HTMLElement): void {
  if (panel.hidden || panel.closest('[hidden]')) return;
  const width = innerWidth, height = innerHeight;
  const elements = [...document.querySelectorAll<HTMLElement>(BLOCKERS)];
  const signature = `${width}/${height}/${panel.dataset.context}/${panel.textContent}/${panel.closest<HTMLElement>('.dw-ui')?.dataset.device}/${elements.map(el => `${el.className}:${el.hidden}:${el.getAttribute('style')}:${el.textContent}`).join(';')}`;
  const now = performance.now(), previous = checks.get(panel);
  // Visibility/content changes reserve their slot immediately. Stable frames need no
  // forced layout; a bounded check follows CSS fades and notices during transitions.
  if (previous?.signature === signature && now < previous.next) return;
  checks.set(panel, { signature, next: now + 50 });
  const occupied = elements.filter(painted).map(paintedBounds);
  const key = `${width}/${height}/${panel.dataset.context}/${panel.textContent}/${occupied.map(r => [r.left,r.top,r.right,r.bottom].join(',')).join(';')}`;
  if (layouts.get(panel) === key) return;
  layouts.set(panel, key);
  panel.style.visibility = '';
  panel.classList.remove('is-status-only');
  const fullWidth = Math.min(290, Math.max(160, width * .32));
  const sideWidth = Math.max(96, Math.min(160, width * .35 - MARGIN - GAP));
  for (const [compact, panelWidth] of [[false, fullWidth], [true, fullWidth], [true, sideWidth]] as const) {
    panel.style.width = `${panelWidth}px`;
    panel.classList.toggle('is-compact', compact);
    const box = panel.getBoundingClientRect();
    const slot = edgeSlot(width, height, box.width, box.height, occupied);
    if (slot) {
      panel.style.left = `${slot.left}px`; panel.style.top = `${slot.top}px`;
      panel.dataset.layout = compact ? 'compact' : 'full';
      return;
    }
  }
  // Try the resource alone before dropping a secondary overlay in an unsatisfiable
  // viewport. There is no unchecked corner fallback covering existing instruments.
  if(panel.dataset.essential==='true'){
    panel.classList.add('is-status-only');
    for(const panelWidth of [fullWidth,sideWidth]){
      panel.style.width=`${panelWidth}px`;
      const box=panel.getBoundingClientRect(),slot=edgeSlot(width,height,box.width,box.height,occupied);
      if(!slot)continue;
      panel.style.left=`${slot.left}px`;panel.style.top=`${slot.top}px`;panel.dataset.layout='status-only';return;
    }
  }
  panel.dataset.layout='suppressed';panel.style.visibility='hidden';
}
