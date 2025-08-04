# Page snapshot

```yaml
- link "Skip to content":
  - /url: "#main-content"
- banner:
  - link "Testero Home":
    - /url: /
    - text: Testero
  - navigation "Primary navigation":
    - link "Home":
      - /url: /
    - link "Content Hub":
      - /url: /content
    - link "FAQ":
      - /url: /faq
  - link "Join Waitlist":
    - /url: /waitlist
  - link "Login":
    - /url: /login
- main:
  - heading "Verification Failed" [level=1]
  - paragraph: There was a problem verifying your email
  - img
  - heading "Verification Failed" [level=3]
  - paragraph: No verification token found in URL
  - paragraph: The verification link may have expired or been used already.
  - button "Return to Login"
- alert
- button "Open Next.js Dev Tools":
  - img
```