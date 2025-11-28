/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionNavigator } from '@/components/practice-test/QuestionNavigator';

describe('QuestionNavigator', () => {
  const defaultProps = {
    totalQuestions: 10,
    currentIndex: 0,
    answeredQuestionIds: new Set<string>(),
    flaggedQuestionIds: new Set<string>(),
    questionIds: Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
    onQuestionClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correct number of tiles', () => {
    render(
      <QuestionNavigator
        {...defaultProps}
        totalQuestions={5}
        questionIds={Array.from({ length: 5 }, (_, i) => `q${i + 1}`)}
      />
    );
    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(5);
  });

  it('highlights current question', () => {
    render(<QuestionNavigator {...defaultProps} currentIndex={2} />);
    const tiles = screen.getAllByRole('button');
    // Tile at index 2 should be current (question 3)
    expect(tiles[2]).toHaveClass('bg-blue-600');
  });

  it('shows answered questions with blue fill', () => {
    const answered = new Set(['q1', 'q2']);
    render(
      <QuestionNavigator
        {...defaultProps}
        currentIndex={4} // Set current to last question so first two aren't current
        answeredQuestionIds={answered}
        questionIds={['q1', 'q2', 'q3', 'q4', 'q5']}
      />
    );
    const tiles = screen.getAllByRole('button');
    // First two tiles should be answered (not current)
    expect(tiles[0]).toHaveClass('bg-blue-50');
    expect(tiles[1]).toHaveClass('bg-blue-50');
  });

  it('shows flagged questions with flag icon', () => {
    const flagged = new Set(['q1']);
    render(
      <QuestionNavigator
        {...defaultProps}
        flaggedQuestionIds={flagged}
        questionIds={['q1', 'q2']}
      />
    );
    const flagIcons = screen.getAllByTestId('flag-icon');
    expect(flagIcons).toHaveLength(1);
  });

  it('calls onQuestionClick when tile is clicked', async () => {
    const user = userEvent.setup();
    const onQuestionClick = jest.fn();
    render(
      <QuestionNavigator
        {...defaultProps}
        onQuestionClick={onQuestionClick}
        questionIds={['q1', 'q2']}
      />
    );
    
    const tiles = screen.getAllByRole('button');
    await user.click(tiles[1]);
    
    expect(onQuestionClick).toHaveBeenCalledWith(1);
  });

  it('displays question numbers correctly', () => {
    render(
      <QuestionNavigator
        {...defaultProps}
        totalQuestions={3}
        questionIds={['q1', 'q2', 'q3']}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders grid with 5 columns on desktop', () => {
    const { container } = render(
      <QuestionNavigator
        {...defaultProps}
        totalQuestions={10}
        questionIds={Array.from({ length: 10 }, (_, i) => `q${i + 1}`)}
      />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-5');
  });
});

