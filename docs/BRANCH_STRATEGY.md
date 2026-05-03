# Git Branch Strategy

## Branch Structure

```
main          — 🚀 生产分支，稳定代码
develop       — ⚙️ 开发分支，所有新功能先合到此分支
              (PR from feature/* → develop → main)
```

---

## 日常开发流程

```
feature/xxx  →  develop  →  main  →  部署
```

| 场景 | 操作 |
|------|------|
| 开发新功能 | `git checkout -b feature/功能名 develop` |
| 提交代码 | `git push origin feature/功能名` |
| 合并到开发分支 | GitHub PR: `feature/xxx` → `develop` |
| 合并到生产分支 | GitHub PR: `develop` → `main` |
| hotfix | `git checkout -b hotfix/问题名 main`，完成后直接 PR → `main` |

---

## 分支命名规范

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 功能 | `feature/功能名` | `feature/investment-portfolio` |
| 修复 | `bugfix/问题名` | `bugfix/transaction-crash` |
| 热修复 | `hotfix/问题名` | `hotfix/login-error` |
| 重构 | `refactor/模块名` | `refactor/db-schema` |

---

## 当前状态

- ✅ `main` — 生产稳定版本
- ⚙️ `develop` — 开发中（当前工作分支）
