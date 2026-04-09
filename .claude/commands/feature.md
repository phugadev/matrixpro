---
name: feature
description: Implements a feature, or set of features, from start to finish.
---

When implementing a feature, follow this workflow:

1. **Implement** — build the feature/s being discussed
2. **Walk through** — brief description of relevant code changes; flag any common mistake or gotcha
3. **Update context** — patch CODEAUDIT.md; bump `package.json` version; update memory if something non-obvious was learned
4. **Ship** — run the exact commands to build, tag, and create the GitHub release, then give a one-paragraph summary of what was pushed
