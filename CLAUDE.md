<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **sfl-tracker** (405 symbols, 681 relationships, 8 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/sfl-tracker/context` | Codebase overview, check index freshness |
| `gitnexus://repo/sfl-tracker/clusters` | All functional areas |
| `gitnexus://repo/sfl-tracker/processes` | All execution flows |
| `gitnexus://repo/sfl-tracker/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Custom AI Guidelines

- **MUST READ SKILLS FIRST:** Trước khi thực hiện bất kỳ thay đổi nào liên quan đến thiết kế, UI/UX, lập trình Frontend/Backend hoặc Code Review, bạn BẮT BUỘC phải đọc và áp dụng các tiêu chuẩn được quy định tại thư mục `.claude/` của dự án.

## AI Routing (Quy tắc tự động kích hoạt Skill)

Để đảm bảo bộ não AI không bị quá tải và áp dụng chính xác các kỹ năng vào đúng tình huống, dưới đây là quy tắc định tuyến (routing) bắt buộc:

1. **Khi làm việc với Giao diện (UI/UX, React Components):**
   - TRƯỚC TIÊN phải đọc `.claude/skills/ui-ux-pro-max/SKILL.md` và `.claude/skills/senior-frontend/SKILL.md`.

2. **Khi phát triển API, Logic Server (Node.js/Express):**
   - TRƯỚC TIÊN phải đọc `.claude/skills/senior-backend/SKILL.md`.

3. **Khi thao tác với Database (MongoDB, query, schema, aggregation):**
   - BẮT BUỘC đọc và áp dụng `.claude/skills/database-architect/SKILL.md` để đảm bảo truy vấn được tối ưu.

4. **Khi viết Code xử lý Logic tính toán, hoặc khi hoàn thành một chức năng:**
   - LUÔN LUÔN kích hoạt `.claude/skills/test-engineer/SKILL.md` để đề xuất và viết kịch bản Unit Test (Jest/Vitest) trước khi chuyển sang bước tiếp theo.

5. **Khi Review Code hoặc tối ưu lại mã nguồn (Refactor):**
   - Phải đọc `.claude/skills/code-reviewer/SKILL.md` và áp dụng các tiêu chuẩn dọn dẹp mã nguồn.
