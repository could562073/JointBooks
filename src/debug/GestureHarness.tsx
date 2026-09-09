import { useState } from 'react';
import { GESTURE } from '../lib/gesture';
import { useDragGesture } from '../lib/useDragGesture';

/** 每個 preset 一個可拖曳方塊，外加一顆按鈕用來驗證門檻沒有攔掉 click */
export function GestureHarness() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 24 }}>
      <Box name="monthSwipe" preset={GESTURE.monthSwipe} />
      <Box name="categoryCard" preset={GESTURE.categoryCard} />
      <Box name="calendarHandle" preset={GESTURE.calendarHandle} />
      <Box name="panelDismiss" preset={GESTURE.panelDismiss} />
    </div>
  );
}

function Box({ name, preset }: { name: string; preset: typeof GESTURE.monthSwipe }) {
  const [offset, setOffset] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [...l, s]);

  const { handlers, dragging, touchAction } = useDragGesture(preset, {
    onMove: setOffset,
    onSnap: (d) => { setOffset(0); push(`snap:${d}`); },
    onReturn: () => { setOffset(0); push('return'); },
    onTap: () => push('tap'),
  });

  const axis = preset.axis === 'x' ? 'X' : 'Y';

  return (
    <div>
      <div
        data-testid={`drag-${name}`}
        data-dragging={dragging ? '1' : '0'}
        {...handlers}
        style={{
          width: 200, height: 80, background: 'var(--c-tint)',
          borderRadius: 'var(--r-md)', touchAction,
          transform: `translate3d(${axis === 'X' ? offset : 0}px, ${axis === 'Y' ? offset : 0}px, 0)`,
          willChange: 'transform',
          transition: dragging ? 'none' : `transform 300ms var(--ease-move)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <button
          data-testid={`btn-${name}`}
          onClick={() => push('click')}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          按鈕
        </button>
      </div>
      <output data-testid={`log-${name}`}>{log.join(',')}</output>
    </div>
  );
}
