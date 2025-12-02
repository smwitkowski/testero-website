/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from '@/components/practice-test/QuestionCard';

describe('QuestionCard', () => {
  const defaultProps = {
    questionNumber: 1,
    totalQuestions: 10,
    domainName: 'ML Ops & Deployment',
    scenario: 'You are an ML Engineer at a large e-commerce company.',
    questionStem: 'Which deployment strategy would be most appropriate?',
    options: [
      { label: 'A', text: 'Option A' },
      { label: 'B', text: 'Option B' },
      { label: 'C', text: 'Option C' },
      { label: 'D', text: 'Option D' },
    ],
    selectedOptionLabel: null,
    onOptionSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays domain badge with correct text', () => {
    render(<QuestionCard {...defaultProps} />);
    expect(screen.getByText(/Domain: ML Ops & Deployment/)).toBeInTheDocument();
  });

  it('renders scenario text in styled box', () => {
    render(<QuestionCard {...defaultProps} />);
    const scenario = screen.getByText('You are an ML Engineer at a large e-commerce company.');
    expect(scenario).toBeInTheDocument();
    // Check it's in a container with scenario styling
    expect(scenario.closest('.bg-slate-50')).toBeInTheDocument();
  });

  it('renders all options with A/B/C/D labels', () => {
    render(<QuestionCard {...defaultProps} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('highlights selected option', () => {
    render(<QuestionCard {...defaultProps} selectedOptionLabel="B" />);
    const optionB = screen.getByText('Option B').closest('label');
    expect(optionB).toHaveClass('border-blue-600', 'bg-blue-50');
  });

  it('calls onOptionSelect when option clicked', async () => {
    const user = userEvent.setup();
    const onOptionSelect = jest.fn();
    render(<QuestionCard {...defaultProps} onOptionSelect={onOptionSelect} />);
    
    const optionA = screen.getByText('Option A').closest('label');
    if (optionA) {
      await user.click(optionA);
      expect(onOptionSelect).toHaveBeenCalledWith('A');
    }
  });

  it('displays question number correctly', () => {
    render(<QuestionCard {...defaultProps} questionNumber={12} totalQuestions={50} />);
    expect(screen.getByText('Question 12 of 50')).toBeInTheDocument();
  });

  it('renders question stem below scenario', () => {
    render(<QuestionCard {...defaultProps} />);
    const stem = screen.getByText('Which deployment strategy would be most appropriate?');
    expect(stem).toBeInTheDocument();
    // Stem should come after scenario in DOM
    const scenario = screen.getByText('You are an ML Engineer at a large e-commerce company.');
    expect(scenario.compareDocumentPosition(stem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('handles missing scenario gracefully', () => {
    render(<QuestionCard {...defaultProps} scenario="" />);
    // Should still render question stem
    expect(screen.getByText('Which deployment strategy would be most appropriate?')).toBeInTheDocument();
  });
});

