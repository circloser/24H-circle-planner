import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPickerDialog } from '../IconPickerDialog';

afterEach(() => {
  cleanup();
});

describe('IconPickerDialog', () => {
  it('renders nothing when closed', () => {
    const { unmount } = render(
      <IconPickerDialog
        open={false}
        onOpenChange={() => {}}
        selectedIcon=""
        onPick={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
  });

  it('renders dialog when open', () => {
    const { unmount } = render(
      <IconPickerDialog
        open={true}
        onOpenChange={() => {}}
        selectedIcon=""
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByText('아이콘 선택')).not.toBeNull();
    unmount();
  });

  it('shows 수면 category tab and 💤 chip; clicking calls onPick', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { unmount } = render(
      <IconPickerDialog
        open={true}
        onOpenChange={() => {}}
        selectedIcon=""
        onPick={onPick}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const sleepTab = within(dialog).getByRole('tab', { name: /수면/ });
    await user.click(sleepTab);

    await waitFor(() => {
      const buttons = within(dialog).getAllByRole('button', { name: /💤/ });
      expect(buttons.length).toBeGreaterThan(0);
    });

    const zzzBtn = within(dialog).getAllByRole('button', { name: /💤/ })[0];
    await user.click(zzzBtn);

    expect(onPick).toHaveBeenCalledWith('💤', expect.anything());
    unmount();
  });

  it('searching 독서 shows 📚 in results', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <IconPickerDialog
        open={true}
        onOpenChange={() => {}}
        selectedIcon=""
        onPick={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const searchInput = within(dialog).getByPlaceholderText('아이콘 검색...');
    await user.type(searchInput, '독서');

    await waitFor(() => {
      const buttons = within(dialog).getAllByRole('button', { name: /📚/ });
      expect(buttons.length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('shows search result count when searching', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <IconPickerDialog
        open={true}
        onOpenChange={() => {}}
        selectedIcon=""
        onPick={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const searchInput = within(dialog).getByPlaceholderText('아이콘 검색...');
    await user.type(searchInput, '수면');

    await waitFor(() => {
      expect(within(dialog).getByText(/검색 결과/)).not.toBeNull();
    });

    unmount();
  });

  it('calls onPick and closes dialog when icon is picked via search', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOpenChange = vi.fn();

    const { unmount } = render(
      <IconPickerDialog
        open={true}
        onOpenChange={onOpenChange}
        selectedIcon=""
        onPick={onPick}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const searchInput = within(dialog).getByPlaceholderText('아이콘 검색...');
    await user.type(searchInput, '수면');

    await waitFor(() => {
      const buttons = within(dialog).getAllByRole('button', { name: /💤/ });
      expect(buttons.length).toBeGreaterThan(0);
    });

    const zzzBtn = within(dialog).getAllByRole('button', { name: /💤/ })[0];
    await user.click(zzzBtn);

    expect(onPick).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });
});
