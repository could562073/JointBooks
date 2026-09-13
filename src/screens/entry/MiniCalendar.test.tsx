import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniCalendar } from './MiniCalendar';

/** 預設走「有動畫」的路徑；要看 reduced-motion 的測試自己再覆寫一次 */
function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

beforeEach(() => stubMotion(false));
afterEach(() => vi.unstubAllGlobals());

const BASE = { value: '2026-09-06', onChange: () => {}, onClose: () => {} };

describe('MiniCalendar 的格線', () => {
  it('標題顯示選中日所在的年月', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-title')).toHaveTextContent('2026年9月');
  });

  it('格數等於當月天數', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-30')).toBeInTheDocument();
    expect(screen.queryByTestId('mini-day-31')).not.toBeInTheDocument();
  });

  it('1 號前的空格數跟著星期走', () => {
    // 2026-09-01 是週二，週一起始要空 1 格
    const { container } = render(<MiniCalendar {...BASE} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('選中日標成 aria-pressed', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-6')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mini-day-7')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('MiniCalendar 的換月', () => {
  it('› 往後一個月，選中日跟著移動', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onChange).toHaveBeenCalledWith('2026-10-06');
  });

  it('‹ 往前一個月，跨年正確', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} value="2026-01-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(onChange).toHaveBeenCalledWith('2025-12-15');
  });

  it('跳到天數較少的月份時夾到月底', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} value="2026-01-31" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onChange).toHaveBeenCalledWith('2026-02-28');
  });

  it('換月不會收合面板', () => {
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MiniCalendar 的選日', () => {
  it('選日回報新日期並收合（§5：選日後即收合）', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-day-18'));
    expect(onChange).toHaveBeenCalledWith('2026-09-18');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MiniCalendar 的兩顆鍵', () => {
  it('「今天」跳到今天並收合', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0));
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-today'));
    expect(onChange).toHaveBeenCalledWith('2026-09-09');
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('「收起」只收合，不動日期', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('今天的那一格被標出來', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0));
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-9')).toHaveAttribute('data-today');
    expect(screen.getByTestId('mini-day-8')).not.toHaveAttribute('data-today');
    vi.useRealTimers();
  });
});

describe('MiniCalendar 的換月動畫（MOTION #7，與日常頁月曆同一套）', () => {
  it('剛打開時不播滑入', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-grid')).not.toHaveAttribute('data-slide');
  });

  it('› 下個月從右邊滑進來', () => {
    render(<MiniCalendar {...BASE} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('mini-grid')).toHaveAttribute('data-slide', 'next');
  });

  it('‹ 上個月從左邊滑進來', () => {
    render(<MiniCalendar {...BASE} />);
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(screen.getByTestId('mini-grid')).toHaveAttribute('data-slide', 'prev');
  });

  it('連按兩次每次都重播：格線是重新掛上的新節點', () => {
    render(<MiniCalendar {...BASE} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    const first = screen.getByTestId('mini-grid');
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('mini-grid')).not.toBe(first);
  });

  it('reduced-motion 時換月不播滑入', () => {
    stubMotion(true);
    render(<MiniCalendar {...BASE} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('mini-grid')).not.toHaveAttribute('data-slide');
  });
});

describe('MiniCalendar 的左右滑換月', () => {
  /**
   * 用真實 pointer 事件拖：先越過接管門檻，再拖到指定距離放手。
   *
   * 每個事件都帶上間隔合理的 timeStamp。useDragGesture 用 e.timeStamp 算放手
   * 速度，而 jsdom 連續派發的事件時間戳幾乎相同——dt≈0、速度變成天文數字，
   * 一點點位移都會被當成快速甩動而換月。真實手指拖 20px 至少要幾十毫秒。
   * EventInit 設不了 timeStamp，只能先建事件、再把屬性定義上去。
   */
  function drag(dx: number) {
    const el = screen.getByTestId('mini-swipe');
    const at = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, t: number) => {
      const ev = createEvent[type](el, { pointerId: 1, clientX: x, clientY: 20 });
      Object.defineProperty(ev, 'timeStamp', { value: t });
      fireEvent(el, ev);
    };
    at('pointerDown', 200, 1000);
    at('pointerMove', 200 + Math.sign(dx) * 15, 1080);
    at('pointerMove', 200 + dx, 1160);
    at('pointerUp', 200 + dx, 1240);
  }

  it('往左滑到底換到下個月', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} />);
    drag(-200);
    expect(onChange).toHaveBeenCalledWith('2026-10-06');
  });

  it('往右滑到底換到上個月', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} />);
    drag(200);
    expect(onChange).toHaveBeenCalledWith('2026-08-06');
  });

  it('滑動換月也播對應方向的滑入', () => {
    render(<MiniCalendar {...BASE} />);
    drag(-200);
    expect(screen.getByTestId('mini-grid')).toHaveAttribute('data-slide', 'next');
  });

  it('滑不到門檻就彈回，不換月', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} />);
    drag(-20);
    expect(onChange).not.toHaveBeenCalled();
  });
});
