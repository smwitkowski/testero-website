/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestHeader } from '@/components/practice-test/TestHeader';

describe('TestHeader', () => {
  const defaultProps = {
    examName: 'Google PMLE',
    testType: 'Practice Test',
    onExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays exam name and test type', () => {
    render(<TestHeader {...defaultProps} />);
    expect(screen.getByText(/Google PMLE/)).toBeInTheDocument();
    expect(screen.getByText(/Practice Test/)).toBeInTheDocument();
  });

  it('shows exit button', () => {
    render(<TestHeader {...defaultProps} />);
    const exitButton = screen.getByRole('button', { name: /exit/i });
    expect(exitButton).toBeInTheDocument();
  });

  it('calls onExit when exit button is clicked', async () => {
    const user = userEvent.setup();
    const onExit = jest.fn();
    render(<TestHeader {...defaultProps} onExit={onExit} />);
    
    const exitButton = screen.getByRole('button', { name: /exit/i });
    await user.click(exitButton);
    
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('displays progress bar', () => {
    render(<TestHeader {...defaultProps} progressPercent={25} />);
    const progressBar = screen.getByRole('progressbar', { hidden: true });
    expect(progressBar).toBeInTheDocument();
  });
});




