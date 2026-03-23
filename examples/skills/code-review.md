# Code Review Skill

When asked to review code, follow this structured approach:

## Review Checklist

1. **Security**: Check for injection, XSS, hardcoded secrets, insecure APIs
2. **Performance**: Look for N+1 queries, unnecessary re-renders, missing caching
3. **Correctness**: Verify edge cases, error handling, null checks
4. **Maintainability**: Assess naming, complexity, code organization
5. **Testing**: Check test coverage for new/changed code

## Output Format

Rate each category 1-5 and provide specific findings with file:line references.
