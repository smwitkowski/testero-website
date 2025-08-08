# Testero Success Metrics & KPIs
*Last Updated: [DATE]*

## North Star Metrics by Growth Stage

### Stage 1: Launch to PMF (0 → $1k MRR)
**North Star:** Weekly Active Users (WAU)  
**Strategic Question:** Do users experience core value quickly and stick around?

### Stage 2: Scaling B2C ($1k → $10k+ MRR)
**North Star:** Net New MRR  
**Strategic Question:** Is our business model sustainable and are we delivering exam success?

### Stage 3: Enterprise Expansion (B2B Motion)
**North Star:** Pilot-to-Paid Conversion Rate  
**Strategic Question:** Can we translate individual user love into enterprise contracts?

## Core Metrics Dashboard

### 📊 Business Health Metrics

| Metric | Current | Target | Benchmark Source | Update Frequency |
|--------|---------|--------|------------------|------------------|
| **Growth & Revenue** |
| Monthly Recurring Revenue (MRR) | $[X] | [Next milestone] | Internal | Daily |
| MRR Growth Rate | [X]% | >20% monthly (early stage) | SaaS benchmarks | Weekly |
| Gross MRR Churn | [X]% | <5.3% monthly | ChartMogul median | Monthly |
| Net MRR Churn | [X]% | <2.3% monthly | ChartMogul median | Monthly |
| **Unit Economics** |
| Customer Acquisition Cost (CAC) | $[X] | <$50 (prosumer) | B2C SaaS avg: $53-91 | Monthly |
| Customer Lifetime Value (LTV) | $[X] | >$150 | Calculated | Monthly |
| LTV:CAC Ratio | [X]:1 | >3:1 | Industry standard | Monthly |
| Payback Period | [X] months | <6 months | Bootstrapped SaaS | Monthly |

### 🎯 Product & Engagement Metrics

| Metric | Current | Target | Benchmark Source | Update Frequency |
|--------|---------|--------|------------------|------------------|
| **Activation & Onboarding** |
| Activation Rate* | [X]% | >40% | AI/ML SaaS: 54.8% | Weekly |
| Time-to-Value | [X] min | <5 minutes | Internal goal | Weekly |
| Onboarding Completion | [X]% | >30% | EdTech avg: 13.2% | Weekly |
| **Engagement** |
| Core Feature Adoption** | [X]% | >25% | B2B SaaS: 24.5% | Weekly |
| Session Frequency | [X]/week | 3-4 sessions | Learning science | Weekly |
| Session Duration | [X] min | 20-30 minutes | Cognitive research | Weekly |
| Month 1 Retention | [X]% | >46.9% | B2B SaaS average | Monthly |
| **Conversion** |
| Visitor → Trial | [X]% | 5-8% | SaaS benchmarks | Weekly |
| Trial → Paid | [X]% | >25% | High-intent products | Weekly |
| Waitlist → Active | [X]% | ≥25% | Internal target | Weekly |

*Activation = User completes diagnostic OR generates first study plan  
**Core features: AI Study Plan, Practice Exams, Spaced Repetition

### 🎓 Learning Efficacy Metrics (Competitive Differentiator)

| Metric | Current | Target | Measurement Method | Update Frequency |
|--------|---------|--------|-------------------|------------------|
| **Outcome Metrics** |
| Practice-to-Performance Correlation | [X] | >0.7 | Statistical analysis | Quarterly |
| Self-Reported Pass Rate | [X]% | ≥80% | Post-exam survey | Quarterly |
| "Test-Ready" Accuracy*** | [X]% | >85% | Internal algorithm | Monthly |
| **Learning Process** |
| Avg. Readiness Score Delta | +[X]% | ≥30% | Pre/post diagnostics | Monthly |
| Knowledge Retention Score | [X]/100 | >75 | Spaced repetition data | Weekly |
| Question Quality Rating | [X]/5 | ≥4.0/5 | In-app ratings | Daily |
| **Satisfaction** |
| Net Promoter Score (NPS) | [X] | ≥47 | EdTech benchmark: 47.5 | Monthly |
| Support Ticket Rate | [X]% | <5% of MAU | Internal benchmark | Weekly |

***Users scoring >85% on practice exams who pass official exam

### 🏢 Enterprise Metrics (Future State)

| Metric | Current | Target | Benchmark | Update Frequency |
|--------|---------|--------|-----------|------------------|
| **Lead Generation** |
| Domain Velocity**** | [X] | Track top 20 | PLG signal | Weekly |
| Qualified Enterprise Leads | [X] | 5/month | From domain analysis | Monthly |
| **Sales Performance** |
| Pilot Programs Started | [X] | 2/quarter | Internal goal | Monthly |
| Pilot → Paid Conversion | [X]% | >60% | Enterprise SaaS | Quarterly |
| Average Contract Value | $[X] | >$10k/year | L&D budgets | Quarterly |
| **Client Success** |
| Team Engagement Rate | [X]% | >80% | Pilot success criteria | Monthly |
| Client-Reported ROI | [X]% | >200% | Training industry | Annually |

****Sign-ups from same email domain (e.g., @google.com)

## Churn Segmentation (Critical for Cert Prep)

### Redefining "Good" vs "Bad" Churn

| Churn Type | Definition | Current % | Action |
|------------|------------|-----------|--------|
| **Successful Churn** | Passed exam & cancelled | [X]% | Celebrate! Use for testimonials |
| **Unsuccessful Churn** | All other reasons | [X]% | Investigate & reduce |

**Exit Survey Categories:**
1. ✅ Passed my exam! (Success story)
2. 📚 Still studying (Potential win-back)
3. 😕 Didn't meet my needs (Product gap)
4. 💰 Too expensive (Pricing issue)
5. 🔄 Switched to competitor (Competitive loss)
6. ❌ No longer pursuing cert (Market loss)

## Leading Indicators Watch List

### Daily Pulse Checks
- New sign-ups trend (7-day moving average)
- Daily active users (DAU)
- Questions answered per active user
- API costs as % of revenue

### Weekly Analysis
- Cohort retention curves
- Feature adoption funnels
- Domain velocity for top companies
- Content coverage gaps by exam

### Monthly Deep Dives
- LTV:CAC by acquisition channel
- Churn reason analysis
- NPS driver analysis
- Competitive win/loss reasons

## Measurement Infrastructure

### Data Collection Stack
- **Analytics:** Segment → Mixpanel (behavior) + BigQuery (warehouse)
- **Surveys:** Delighted (NPS) + Custom exit surveys
- **Internal:** Supabase queries + custom dashboards
- **Financial:** Stripe + manual tracking spreadsheet

### Key Reports to Build
1. **Daily Dashboard:** MRR, DAU, new signups, churn
2. **Weekly Metrics Review:** All primary KPIs + trends
3. **Monthly Board Report:** Strategic metrics + narrative
4. **Quarterly Cohort Analysis:** Retention curves by segment

## Strategic Metric Evolution

As Testero grows, certain metrics gain or lose importance:

### De-emphasize Over Time
- Vanity metrics (total registered users)
- Simple engagement (login frequency)
- Feature shipment velocity

### Emphasize More Over Time
- Outcome metrics (pass rates, ROI)
- Expansion revenue opportunities
- Enterprise pipeline metrics
- Multi-exam user percentage

## Action Triggers

**Red Flags (Immediate Action Required):**
- Weekly churn >8%
- CAC payback >9 months
- NPS drops below 30
- Trial → Paid conversion <15%
- Month 1 retention <40%

**Growth Signals (Double Down):**
- Domain velocity spike (>5 from one company)
- Practice-to-performance correlation >0.8
- Organic/referral traffic >40% of signups
- "Successful churn" testimonials increasing

Remember: In AI-powered EdTech, proving efficacy IS the business model. Every metric should ultimately tie back to demonstrating that Testero helps users pass their exams.