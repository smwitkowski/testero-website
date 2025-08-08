# Testero Risk & Assumptions Registry
*Last Updated: [DATE]*

## Key Assumptions

| Category | Assumption | Impact if Wrong | Validation Method |
|----------|------------|-----------------|-------------------|
| **Cost** | OpenAI API ≤20% of revenue | Negative unit economics | Monitor weekly |
| **Market** | Blueprints update ≤2x/year | Content overhead | Track changes |
| **Usage** | 80% desktop, 20% mobile | Poor mobile experience | Analytics |
| **Behavior** | 30min sessions, 3x/week | Engagement model wrong | Track actual |

## Risk Register

| Risk | Impact | Likelihood | Status | Mitigation | Owner |
|------|--------|------------|--------|------------|-------|
| AI hallucinations | High | Medium | Active | SME review + auto-validation | Content |
| Trademark C&D | Medium | Low | Monitoring | Generic names, licensing ready | Legal |
| Slow user acquisition | High | Medium | Active | 2x SEO, referrals, influencers | Growth |
| API cost spike | Medium | Medium | Monitoring | Fine-tune OSS models | Tech |
| Data breach | High | Low | Active | Pen tests, SOC 2, encryption | Security |

## Contingency Plans
- **If API costs >30%:** Immediate switch to Mixtral for basic questions
- **If acquisition <50% target:** Pivot to B2B2C partnerships
- **If pass rates <65%:** Emergency content quality sprint