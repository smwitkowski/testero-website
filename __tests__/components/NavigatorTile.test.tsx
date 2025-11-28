/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigatorTile } from '@/components/ui/navigator-tile';

describe('NavigatorTile', () => {
  const defaultProps = {
    questionNumber: 1,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default state with gray outline', () => {
    render(<NavigatorTile {...defaultProps} />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveClass('border-slate-200', 'bg-white');
    expect(tile).not.toHaveClass('bg-blue-50', 'bg-blue-600');
  });

  it('renders answered state with blue fill', () => {
    render(<NavigatorTile {...defaultProps} isAnswered />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveClass('bg-blue-50', 'border-blue-200');
    expect(tile).not.toHaveClass('bg-blue-600');
  });

  it('renders current state with solid blue', () => {
    render(<NavigatorTile {...defaultProps} isCurrent />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveClass('bg-blue-600', 'text-white', 'border-blue-600');
  });

  it('shows flag icon when flagged', () => {
    render(<NavigatorTile {...defaultProps} isFlagged />);
    const flagIcon = screen.getByTestId('flag-icon');
    expect(flagIcon).toBeInTheDocument();
    expect(flagIcon).toHaveClass('text-amber-400');
  });

  it('does not show flag icon when not flagged', () => {
    render(<NavigatorTile {...defaultProps} />);
    const flagIcon = screen.queryByTestId('flag-icon');
    expect(flagIcon).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<NavigatorTile {...defaultProps} onClick={onClick} />);
    
    const tile = screen.getByRole('button');
    await user.click(tile);
    
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('displays correct question number', () => {
    render(<NavigatorTile {...defaultProps} questionNumber={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('combines answered and flagged states correctly', () => {
    render(<NavigatorTile {...defaultProps} isAnswered isFlagged />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveClass('bg-blue-50', 'border-blue-200');
    expect(screen.getByTestId('flag-icon')).toBeInTheDocument();
  });

  it('combines current and flagged states correctly', () => {
    render(<NavigatorTile {...defaultProps} isCurrent isFlagged />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveClass('bg-blue-600', 'text-white');
    expect(screen.getByTestId('flag-icon')).toBeInTheDocument();
  });
});

