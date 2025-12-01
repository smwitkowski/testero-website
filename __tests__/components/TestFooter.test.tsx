/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestFooter } from '@/components/practice-test/TestFooter';

describe('TestFooter', () => {
  const defaultProps = {
    questionNumber: 12,
    totalQuestions: 50,
    answeredCount: 10,
    unansweredCount: 2,
    flaggedCount: 1,
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    onSubmit: jest.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays question number and stats', () => {
    render(<TestFooter {...defaultProps} />);
    expect(screen.getByText(/Question 12 of 50/)).toBeInTheDocument();
    expect(screen.getByText(/10 answered/)).toBeInTheDocument();
    expect(screen.getByText(/2 unanswered/)).toBeInTheDocument();
    expect(screen.getByText(/1 flagged/)).toBeInTheDocument();
  });

  it('shows Previous button', () => {
    render(<TestFooter {...defaultProps} />);
    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).toBeInTheDocument();
  });

  it('disables Previous button on first question', () => {
    render(<TestFooter {...defaultProps} isFirstQuestion />);
    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).toBeDisabled();
  });

  it('calls onPrevious when Previous button is clicked', async () => {
    const user = userEvent.setup();
    const onPrevious = jest.fn();
    render(<TestFooter {...defaultProps} onPrevious={onPrevious} />);
    
    const prevButton = screen.getByRole('button', { name: /previous/i });
    await user.click(prevButton);
    
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('shows Next button when not on last question', () => {
    render(<TestFooter {...defaultProps} />);
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeInTheDocument();
  });

  it('shows Submit Test button on last question', () => {
    render(<TestFooter {...defaultProps} isLastQuestion />);
    const submitButton = screen.getByRole('button', { name: /submit test/i });
    expect(submitButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('calls onNext when Next button is clicked', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    render(<TestFooter {...defaultProps} onNext={onNext} />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit when Submit Test button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<TestFooter {...defaultProps} isLastQuestion onSubmit={onSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: /submit test/i });
    await user.click(submitButton);
    
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});



