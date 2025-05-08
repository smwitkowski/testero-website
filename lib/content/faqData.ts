export type FaqEntry = {
  pillar: string;
  question: string;
  answer: string;
  slug: string;
  answerSnippet: string;
  internal_link: string;
  data_points: {
    search_volume_us: number;
    keyword_difficulty: number;
    cpc_usd: number;
    exam_length_minutes: number | null;
    num_questions: number | null;
    cost_usd: number | null;
    passing_score_pct: number | null;
    salary_uplift_pct: number | null;
  };
  citations: string[];
};

export const faqData: FaqEntry[] = [
  {
    pillar: "Cloud Leader",
    question: "What is Google Cloud certification?",
    answer: "[Google Cloud certification](/content/hub/google-cloud-certification-guide) validates your expertise in cloud technology and its implementation within organizations.",
    slug: "what-is-google-cloud-certification",
    answerSnippet: "Google Cloud certification validates your expertise...",
    internal_link: "/content/hub/google-cloud-certification-guide.md",
    data_points: {
      "search_volume_us": 10000,
      "keyword_difficulty": 60,
      "cpc_usd": 5.00,
      "exam_length_minutes": 120,
      "num_questions": 50,
      "cost_usd": 200,
      "passing_score_pct": 70,
      "salary_uplift_pct": 25
    },
    citations: [
      "https://cloud.google.com/learn/certification",
      "https://www.coursera.org/professional-certificates/google-cloud-digital-leader"
    ]
  },
  {
    pillar: "Cloud Leader",
    question: "Is Google Cloud certification worth it?",
    answer: "Generally, yes. [Google Cloud certifications](/content/hub/google-cloud-digital-leader-certification-roadmap-2025) enhance career prospects and are preferred by many employers.",
    slug: "is-google-cloud-certification-worth-it",
    answerSnippet: "Generally, yes. Google Cloud certifications...",
    internal_link: "/content/hub/google-cloud-digital-leader-certification-roadmap-2025.md",
    data_points: {
      "search_volume_us": 4000,
      "keyword_difficulty": 50,
      "cpc_usd": 4.00,
      "exam_length_minutes": null,
      "num_questions": null,
      "cost_usd": null,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://cloud.google.com/learn/certification",
      "https://www.testpreptraining.com/blog/is-google-cloud-digital-leader-certification-worth-it/"
    ]
  },
  {
    pillar: "Cloud Leader",
    question: "What are the five sections of the Associate Cloud Engineer certification by Google?",
    answer: "The [Google Associate Cloud Engineer exam](/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025) covers five key sections: 1. Setting up cloud projects and accounts; 2. Planning and configuring compute resources; 3. Deploying and implementing cloud solutions; 4. Ensuring successful operation of cloud solutions; 5. Configuring access and security.",
    slug: "what-are-the-five-sections-of-the-associate-cloud-engineer-certification-by-google",
    answerSnippet: "The Google Associate Cloud Engineer exam covers...",
    internal_link: "/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025.md",
    data_points: {
      "search_volume_us": 800,
      "keyword_difficulty": 25,
      "cpc_usd": 1.50,
      "exam_length_minutes": 120,
      "num_questions": null,
      "cost_usd": 125,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf"
    ]
  },
  {
    pillar: "Cloud Leader",
    question: "(Bonus) How much does Google Cloud Digital Leader cost?",
    answer: "The [Google Cloud Digital Leader certification exam](/content/hub/the-2025-google-cloud-digital-leader-certification-roadmap) costs $99 USD, plus any applicable taxes.",
    slug: "how-much-does-google-cloud-digital-leader-cost",
    answerSnippet: "The Google Cloud Digital Leader certification...",
    internal_link: "/content/hub/the-2025-google-cloud-digital-leader-certification-roadmap.md",
    data_points: {
      "search_volume_us": 1200,
      "keyword_difficulty": 15,
      "cpc_usd": 1.00,
      "exam_length_minutes": 90,
      "num_questions": null,
      "cost_usd": 99,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.datacamp.com/blog/google-cloud-certification"
    ]
  },
  {
    pillar: "Cloud Leader",
    question: "(Bonus) How do you register for Google Cloud certification?",
    answer: "Register via the [Google Cloud website](/content/hub/google-cloud-certification-guide) by selecting your exam and clicking 'Register'.",
    slug: "how-do-you-register-for-google-cloud-certification",
    answerSnippet: "Register via the Google Cloud website...",
    internal_link: "/content/hub/google-cloud-certification-guide.md",
    data_points: {
      "search_volume_us": 900,
      "keyword_difficulty": 20,
      "cpc_usd": 1.20,
      "exam_length_minutes": null,
      "num_questions": null,
      "cost_usd": null,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://support.google.com/cloud-certification/answer/9907651?hl=en"
    ]
  },
  {
    pillar: "Data Analytics",
    question: "How long to complete Google Data Analytics certification?",
    answer: "Google estimates the [Data Analytics Professional Certificate](/content/hub/google-data-analytics-professional-certificate-2025-guide) takes under 6 months to complete.",
    slug: "how-long-to-complete-google-data-analytics-certification",
    answerSnippet: "Google estimates the Data Analytics...",
    internal_link: "/content/hub/google-data-analytics-professional-certificate-2025-guide.md",
    data_points: {
      "search_volume_us": 6000,
      "keyword_difficulty": 10,
      "cpc_usd": 0.80,
      "exam_length_minutes": null,
      "num_questions": null,
      "cost_usd": null,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.coursera.org/professional-certificates/google-data-analytics",
      "https://www.coursera.org/google-career-certificates"
    ]
  },
  {
    pillar: "Data Analytics",
    question: "How long does the Google Data Analytics certification take?",
    answer: "The [Google Data Analytics Professional Certificate](/content/hub/google-data-analytics-professional-certificate-2025-guide) is designed to be completed in under 6 months.",
    slug: "how-long-does-the-google-data-analytics-certification-take",
    answerSnippet: "The Google Data Analytics Professional...",
    internal_link: "/content/hub/google-data-analytics-professional-certificate-2025-guide.md",
    data_points: {
      "search_volume_us": 5500,
      "keyword_difficulty": 12,
      "cpc_usd": 0.85,
      "exam_length_minutes": null,
      "num_questions": null,
      "cost_usd": null,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.coursera.org/professional-certificates/google-data-analytics",
      "https://www.coursera.org/google-career-certificates"
    ]
  },
  {
    pillar: "Data Analytics",
    question: "Is Google Data Analytics certification worth it?",
    answer: "Yes, the [Google Data Analytics certificate](/content/hub/google-data-analytics-professional-certificate-2025-guide) is highly regarded for launching entry-level careers.",
    slug: "is-google-data-analytics-certification-worth-it",
    answerSnippet: "Yes, the Google Data Analytics...",
    internal_link: "/content/hub/google-data-analytics-professional-certificate-2025-guide.md",
    data_points: {
      "search_volume_us": 10000,
      "keyword_difficulty": 55,
      "cpc_usd": 3.00,
      "exam_length_minutes": null,
      "num_questions": null,
      "cost_usd": null,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.coursera.org/professional-certificates/google-data-analytics",
      "https://pangea.ai/resources/is-the-google-data-analytics-certification-worth-it"
    ]
  },
  {
    pillar: "PMLE",
    question: "Is the Google Professional Machine Learning Engineer certification worth it?",
    answer: "Yes, for experienced ML professionals using Google Cloud, the [PMLE certification](/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025) is highly valuable.",
    slug: "is-the-google-professional-machine-learning-engineer-certification-worth-it",
    answerSnippet: "Yes, for experienced ML professionals...",
    internal_link: "/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025.md",
    data_points: {
      "search_volume_us": 1000,
      "keyword_difficulty": 50,
      "cpc_usd": 5.50,
      "exam_length_minutes": 120,
      "num_questions": null,
      "cost_usd": 200,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.testpreptraining.com/blog/is-google-professional-machine-learning-engineer-certification-worth-it/",
      "https://www.cbtnuggets.com/blog/certifications/cloud/is-the-google-professional-machine-learning-engineer-worth-it"
    ]
  },
  {
    pillar: "PMLE",
    question: "How long is the Google ML Engineer exam?",
    answer: "The [Google Cloud Professional Machine Learning Engineer certification exam](/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025) has a duration of 2 hours (120 minutes).",
    slug: "how-long-is-the-google-ml-engineer-exam",
    answerSnippet: "The Google Cloud Professional...",
    internal_link: "/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025.md",
    data_points: {
      "search_volume_us": 500,
      "keyword_difficulty": 10,
      "cpc_usd": 1.60,
      "exam_length_minutes": 120,
      "num_questions": null,
      "cost_usd": 200,
      "passing_score_pct": null,
      "salary_uplift_pct": null
    },
    citations: [
      "https://www.datacamp.com/blog/google-cloud-certification"
    ]
  }
];
