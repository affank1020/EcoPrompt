# Proposed structure

Scope for now: a public landing page (prompt checker + promo content) and an app area that will move behind a login wall later.

```
app/
├── layout.tsx               # Root layout (existing)
├── (marketing)/
│   ├── layout.tsx           # Promo header + footer
│   └── page.tsx             # "/" landing: hero with the checker, plus promo sections
├── (app)/
│   ├── layout.tsx           # App nav
│   └── dashboard/page.tsx   # "/dashboard": your estimate history (login wall later)
└── api/
    └── estimates/route.ts   # POST from extension, GET history (TODO auth check)

proxy.ts                     # Matches /dashboard, REQUIRE_AUTH=false, TODO redirect to /login

lib/
├── types.ts                 # Estimate type (shareable with the extension)
├── estimation.ts            # Water formula, used by both the site and the extension
├── auth.ts                  # getCurrentUser() returns the anonymous user for now
└── data.ts                  # getEstimates(), saveEstimate(); the only file that touches storage

components/
├── Checker.tsx              # Prompt checker used on the landing page
└── ...                      # Promo sections stay inline in page.tsx for now
```

## Notes

- `proxy.ts` is used instead of `middleware.ts` because Next.js 16 renamed the `middleware` file convention to `proxy`.
- The existing `app/page.tsx` will be deleted so it doesn't clash with `app/(marketing)/page.tsx` at `/`.
- Until login exists, data is owned by an anonymous ID stored in the browser.

## When login is added

Only these files change:

- `lib/auth.ts`: return the real logged-in user
- `lib/data.ts`: use the user's ID and a real database
- `proxy.ts`: set `REQUIRE_AUTH = true` and redirect to `/login`
- `app/api/estimates/route.ts`: add the auth check

New: login and sign-up pages under `app/(auth)/`.
