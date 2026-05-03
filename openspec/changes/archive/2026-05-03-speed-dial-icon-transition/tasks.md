## 1. Git Setup

- [x] 1.1 Create feature branch: `git fetch origin && git checkout main && git pull && git checkout -b feat/speed-dial-icon-transition`

## 2. Implementation

- [x] 2.1 In `speed-dial-trigger.vue`, replace single `<span class="material-symbols-outlined icon">add</span>` with two absolutely-positioned icon spans (`menu` and `close`) inside a relative container
- [x] 2.2 Bind opacity of each icon to `isOpen`: `menu` icon `opacity: 1` when closed, `close` icon `opacity: 1` when open
- [x] 2.3 Add CSS `transition: opacity 0.15s ease` to both icon spans
- [x] 2.4 Remove `.fab.open .icon { transform: rotate(45deg) }` style and the `.icon` transition on `transform`

## 3. Finalize

- [x] 3.1 Run `npx eslint . --fix` and `npm run format`, ensure zero warnings
- [x] 3.2 Run `npm run type-check` — must pass
- [x] 3.3 Manually verify fade transition in browser (open/close speed dial)
- [x] 3.4 Prompt user to commit with message: `feat(map): fade-transition menu/close icons in speed dial trigger`
- [x] 3.5 Prompt user to push branch and open PR targeting `main`
