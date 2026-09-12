import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Keypad } from './Keypad';

const BASE = { onKey: () => {}, onSave: () => {}, canSave: true };

describe('Keypad 的按鍵', () => {
  it('1-9、小數點、0、⌫ 共 12 鍵，加上儲存鍵', () => {
    render(<Keypad {...BASE} />);
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'back']) {
      expect(screen.getByTestId(`key-${k}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('key-save')).toBeInTheDocument();
  });

  it('按數字鍵把鍵值回報出去', () => {
    const onKey = vi.fn();
    render(<Keypad {...BASE} onKey={onKey} />);
    fireEvent.click(screen.getByTestId('key-7'));
    expect(onKey).toHaveBeenCalledWith('7');
  });

  it('⌫ 回報 back，並且有無障礙名稱', () => {
    const onKey = vi.fn();
    render(<Keypad {...BASE} onKey={onKey} />);
    fireEvent.click(screen.getByLabelText('刪除'));
    expect(onKey).toHaveBeenCalledWith('back');
  });

  it('儲存鍵只有勾號沒有文字', () => {
    render(<Keypad {...BASE} />);
    const save = screen.getByTestId('key-save');
    expect(save.textContent).toBe('');
    expect(save.querySelector('svg')).toBeInTheDocument();
    expect(save).toHaveAccessibleName('儲存');
  });
});

describe('Keypad 的儲存鍵', () => {
  it('可以存時按下去會回報', () => {
    const onSave = vi.fn();
    render(<Keypad {...BASE} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('key-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('不能存時停用，點了也不會觸發（§5：金額 0 時不寫入）', () => {
    const onSave = vi.fn();
    render(<Keypad {...BASE} canSave={false} onSave={onSave} />);
    expect(screen.getByTestId('key-save')).toBeDisabled();
    fireEvent.click(screen.getByTestId('key-save'));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Keypad 的按壓回饋（MOTION #3）', () => {
  it('按住時標記 pressed，鬆手清掉', () => {
    render(<Keypad {...BASE} />);
    const key = screen.getByTestId('key-5');
    expect(key).not.toHaveAttribute('data-pressed');

    fireEvent.pointerDown(key);
    expect(key).toHaveAttribute('data-pressed');

    fireEvent.pointerUp(key);
    expect(key).not.toHaveAttribute('data-pressed');
  });

  it('手指滑出按鍵也要復原，不會卡在按下的樣子', () => {
    render(<Keypad {...BASE} />);
    const key = screen.getByTestId('key-5');
    fireEvent.pointerDown(key);
    fireEvent.pointerLeave(key);
    expect(key).not.toHaveAttribute('data-pressed');
  });

  it('一次只有一顆是按下狀態', () => {
    render(<Keypad {...BASE} />);
    fireEvent.pointerDown(screen.getByTestId('key-1'));
    fireEvent.pointerDown(screen.getByTestId('key-2'));
    expect(screen.getByTestId('key-1')).not.toHaveAttribute('data-pressed');
    expect(screen.getByTestId('key-2')).toHaveAttribute('data-pressed');
  });
});
