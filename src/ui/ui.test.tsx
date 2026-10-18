import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast, dismissAll } from './toast';
import Toaster from './Toaster';
import { confirmSheet } from './confirm';
import ConfirmHost from './ConfirmHost';
import AsyncButton from './AsyncButton';
import { setLang, t } from '../i18n';

beforeEach(() => { setLang('zh'); act(() => dismissAll()); });

describe('toast', () => {
  it('shows a titled message with details, and it can be closed', async () => {
    render(<Toaster />);
    act(() => toast({ kind: 'ok', title: '已保存', body: 'Mary 的资料已更新' }));
    expect(screen.getByText('已保存')).toBeInTheDocument();
    expect(screen.getByText('Mary 的资料已更新')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
  });

  it('disappears by itself', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast({ kind: 'ok', title: 'Done' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('confirmSheet', () => {
  it('resolves true only when the user confirms', async () => {
    render(<ConfirmHost />);
    let answer: boolean | undefined;
    act(() => { confirmSheet({ title: '删除 Mary？', body: '不能复原', confirmLabel: '删除', danger: true }).then((a) => { answer = a; }); });
    expect(screen.getByRole('dialog', { name: '删除 Mary？' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(answer).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false on cancel', async () => {
    render(<ConfirmHost />);
    let answer: boolean | undefined;
    act(() => { confirmSheet({ title: 'Sure?' }).then((a) => { answer = a; }); });
    await userEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(answer).toBe(false);
  });
});

describe('AsyncButton', () => {
  it('shows progress while working, then a success state', async () => {
    let finish: () => void = () => {};
    render(<AsyncButton onClick={() => new Promise<void>((r) => { finish = r; })}>保存</AsyncButton>);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('button', { name: t('ui.working') })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: t('ui.done') })).toBeInTheDocument();
  });

  it('goes back to normal after a failure', async () => {
    render(<AsyncButton onClick={() => Promise.reject(new Error('x'))}>保存</AsyncButton>);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByRole('button', { name: '保存' })).toBeEnabled();
  });
});
