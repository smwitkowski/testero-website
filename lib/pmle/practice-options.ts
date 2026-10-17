export const comparisonChecked = "2026-10-17";
export const practiceOptions = [
  {
    "name": "Google Cloud Skills Boost / Google Skills",
    "format": "Google-managed PMLE learning path with courses, labs and skill badges.",
    "access": "Pro subscription offers unlimited hands-on labs; no-cost Starter has limited lab access.",
    "price": "$29/month Pro (displayed $); Starter no cost. Check site for local pricing.",
    "url": "https://www.skills.google/paths/17",
    "sources": [
      "https://www.skills.google/paths/17",
      "https://www.skills.google/subscriptions"
    ]
  },
  {
    "name": "Google’s official sample questions",
    "format": "Official examples of question format and possible content, not a full mock exam.",
    "access": "Public Google Forms introduction; Google sign-in is offered to save progress.",
    "price": "check site — no sample price stated in the fetched page.",
    "url": "https://cloud.google.com/learn/certification/machine-learning-engineer",
    "sources": [
      "https://cloud.google.com/learn/certification/machine-learning-engineer",
      "https://docs.google.com/forms/d/e/1FAIpQLSeYmkCANE81qSBqLW0g2X7RoskBX9yGYQu-m1TtsjMvHabGqg/viewform"
    ]
  },
  {
    "name": "Coursera",
    "format": "Preparing for Google Cloud Certification: Machine Learning Engineer Professional Certificate, by Google Cloud Training. Online course series with Qwiklabs hands-on labs.",
    "access": "Listed as included with Coursera Plus. “Enroll for free” does not establish full lab or certificate access.",
    "price": "check site",
    "url": "https://www.coursera.org/professional-certificates/preparing-for-google-cloud-machine-learning-engineer-professional-certificate",
    "sources": [
      "https://www.coursera.org/professional-certificates/preparing-for-google-cloud-machine-learning-engineer-professional-certificate"
    ]
  },
  {
    "name": "GCP Study Hub",
    "format": "PMLE video lessons, hands-on labs and practice exams (provider-described format).",
    "access": "All-access membership for current and future courses. Membership price, not a verified PMLE-only purchase.",
    "price": "$39/month; $89/3 months; $249/year (displayed $). Check site for current terms.",
    "url": "https://gcpstudyhub.com/",
    "sources": [
      "https://gcpstudyhub.com/",
      "https://gcpstudyhub.com/courses/professional-ml-engineer"
    ]
  },
  {
    "name": "Whizlabs",
    "format": "PMLE format not verified from the fetched official page.",
    "access": "Product page returned HTTP 200 without substantive readable product text. Access terms omitted.",
    "price": "check site",
    "url": "https://www.whizlabs.com/google-cloud-certified-professional-machine-learning-engineer/",
    "sources": [
      "https://www.whizlabs.com/google-cloud-certified-professional-machine-learning-engineer/"
    ]
  },
  {
    "name": "Tutorials Dojo",
    "format": "PMLE offering and format not verified.",
    "access": "Official site returned HTTP 403 during this check. Product details and access terms omitted.",
    "price": "check site",
    "url": "https://tutorialsdojo.com/",
    "sources": [
      "https://tutorialsdojo.com/"
    ]
  },
  {
    "name": "Udemy",
    "format": "PMLE course format not verified.",
    "access": "Official page returned HTTP 403 during this check. Course details and access terms omitted.",
    "price": "check site",
    "url": "https://www.udemy.com/topic/google-cloud-professional-machine-learning-engineer/",
    "sources": [
      "https://www.udemy.com/topic/google-cloud-professional-machine-learning-engineer/"
    ]
  },
  {
    "name": "Testero",
    "format": "20-question diagnostic and domain report, plus five-question PMLE practice sessions. Independent provider.",
    "access": "Diagnostic needs no account. Free account: five practice questions per week, no explanations. PMLE Pass: 90 days of practice with explanations, unlimited five-question sessions from the current bank.",
    "price": "USD $39 one-time for 90 days. No subscription or auto-renew. Free diagnostic and limited account practice: $0.",
    "url": "https://testero.ai/pricing",
    "sources": [
      "https://testero.ai/pricing"
    ]
  }
] as const;
