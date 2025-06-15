export const MOCK_QUESTIONS = [
  {
    id: 'test-q1',
    stem: 'What is the primary purpose of feature engineering in machine learning?',
    options: [
      { label: 'A', text: 'To reduce the size of the dataset' },
      { label: 'B', text: 'To transform raw data into meaningful features for ML models' },
      { label: 'C', text: 'To visualize data patterns' },
      { label: 'D', text: 'To store data in databases' }
    ]
  },
  {
    id: 'test-q2',
    stem: 'Which Google Cloud service is primarily used for managed machine learning?',
    options: [
      { label: 'A', text: 'Cloud Storage' },
      { label: 'B', text: 'BigQuery' },
      { label: 'C', text: 'Vertex AI' },
      { label: 'D', text: 'Cloud Functions' }
    ]
  },
  {
    id: 'test-q3',
    stem: 'What is the main advantage of using AutoML compared to custom model training?',
    options: [
      { label: 'A', text: 'Lower cost' },
      { label: 'B', text: 'Faster development with less ML expertise required' },
      { label: 'C', text: 'Better model performance' },
      { label: 'D', text: 'More control over the training process' }
    ]
  }
];

export const MOCK_EXAM_TYPES = [
  { name: "Google Professional ML Engineer", displayName: "Google ML Engineer" },
  { name: "Google Cloud Digital Leader", displayName: "Google Cloud Digital Leader" },
  { name: "Google Cloud Professional Cloud Architect", displayName: "Google Cloud Architect" }
];

export const MOCK_SESSION_RESPONSES = {
  start: {
    sessionId: 'test-session-123',
    questions: MOCK_QUESTIONS,
    totalQuestions: 3,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    anonymousSessionId: 'test-anon-456'
  },
  answer: {
    isCorrect: true,
    correctAnswer: 'B',
    explanation: 'Feature engineering transforms raw data into meaningful features that machine learning algorithms can effectively use to make predictions.'
  },
  complete: {
    totalQuestions: 3,
    correctAnswers: 2,
    score: 67,
    recommendations: ['Focus on areas where you were unsure.'],
    examType: 'Google Professional ML Engineer'
  }
};

export const MOCK_SUMMARY_RESPONSE = {
  summary: {
    sessionId: 'test-session-123',
    examType: 'Google Professional ML Engineer',
    totalQuestions: 3,
    correctAnswers: 2,
    score: 67,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    questions: [
      {
        id: 'test-q1',
        stem: 'What is the primary purpose of feature engineering in machine learning?',
        options: [
          { label: 'A', text: 'To reduce the size of the dataset' },
          { label: 'B', text: 'To transform raw data into meaningful features for ML models' },
          { label: 'C', text: 'To visualize data patterns' },
          { label: 'D', text: 'To store data in databases' }
        ],
        userAnswer: 'B',
        correctAnswer: 'B',
        isCorrect: true
      },
      {
        id: 'test-q2',
        stem: 'Which Google Cloud service is primarily used for managed machine learning?',
        options: [
          { label: 'A', text: 'Cloud Storage' },
          { label: 'B', text: 'BigQuery' },
          { label: 'C', text: 'Vertex AI' },
          { label: 'D', text: 'Cloud Functions' }
        ],
        userAnswer: 'A',
        correctAnswer: 'C',
        isCorrect: false
      },
      {
        id: 'test-q3',
        stem: 'What is the main advantage of using AutoML compared to custom model training?',
        options: [
          { label: 'A', text: 'Lower cost' },
          { label: 'B', text: 'Faster development with less ML expertise required' },
          { label: 'C', text: 'Better model performance' },
          { label: 'D', text: 'More control over the training process' }
        ],
        userAnswer: 'B',
        correctAnswer: 'B',
        isCorrect: true
      }
    ]
  },
  domainBreakdown: [
    {
      domain: 'ML Engineering',
      correct: 2,
      total: 3,
      percentage: 67
    }
  ]
};