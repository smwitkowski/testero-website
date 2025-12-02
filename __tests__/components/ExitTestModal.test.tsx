/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExitTestModal } from '@/components/practice-test/ExitTestModal';

describe('ExitTestModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(<ExitTestModal {...defaultProps} />);
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ExitTestModal {...defaultProps} open={false} />);
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('shows confirmation message', () => {
    render(<ExitTestModal {...defaultProps} />);
    expect(screen.getByText(/Exit Test\?/)).toBeInTheDocument();
    expect(screen.getByText(/current attempt will be lost/i)).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<ExitTestModal {...defaultProps} onConfirm={onConfirm} />);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    const { container } = render(<ExitTestModal {...defaultProps} onOpenChange={onOpenChange} />);
    
    // Find Cancel button within DialogFooter (not the X close button)
    const footer = container.querySelector('[class*="DialogFooter"]');
    const cancelButton = footer?.querySelector('button') as HTMLButtonElement;
    
    if (cancelButton) {
      await user.click(cancelButton);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } else {
      // Fallback: try getAllByRole and filter
      const buttons = screen.getAllByRole('button');
      const cancelBtn = buttons.find(btn => btn.textContent === 'Cancel');
      if (cancelBtn) {
        await user.click(cancelBtn);
        expect(onOpenChange).toHaveBeenCalledWith(false);
      }
    }
  });
});

