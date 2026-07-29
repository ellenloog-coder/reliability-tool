# Demonstration Browser Regression Summary

Date: 2026-07-29  
Browser: Chromium 149.0.7827.55 via Playwright  
URL: http://127.0.0.1:8005/

The real Chromium run successfully opened the HTTP application and completed four desktop checks with screenshots. The extended process terminated before Time-Based, i18n/report-export, and mobile checks completed. These are recorded as BLOCKED, not PASS. Browser Regression therefore remains pending and the release gate is not closed.

| Metric | Result |
|---|---:|
| Total checks | 7 |
| Passed | 4 |
| Failed | 0 |
| Blocked | 3 |
| Console errors in completed checks | 0 |
| Network failures in completed checks | 0 |

Desktop: 4 completed checks passed at 1440x900. Mobile: blocked. i18n: blocked. Report export: blocked. Numerical and unit regressions passed independently: npm test 148/148.

Screenshots are in `verification/screenshots/demonstration/`.
