# 三人协作

一个给三人小组用的协作平台：工作台、项目、任务、文件、好友、日程，外加一个 AI 助手「大肥鱼」。

纯静态前端（HTML + 原生 JS），后端用 [Supabase](https://supabase.com)（Postgres + Auth + Storage + Edge Function）。

## 功能

工作台 · 项目 · 任务 · 文件 · 好友 · 日程 · AI 助手。

**项目文件**：每个项目自带一个文件仓库（类似 GitHub 仓库），项目成员可以上传任意文件，
代码文件（.c / .py / .js / .md …）点开即可在站内查看，带语法高亮、行号和复制按钮。

## 目录

```
index.html         页面骨架（DOM 结构）
assets/app.css     全局样式
assets/vendor/     Supabase SDK 本地打包版（不要改回 CDN）
js/*.js            业务脚本，文件名编号 = 执行顺序（00 → 99）
supabase/          Edge Function 源码（qq-auth），需单独部署
whale.png          AI 头像
```

详细说明见 [项目结构.md](项目结构.md)。

## 本地预览

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

不需要构建步骤，改完刷新即可。

## 部署

静态站托管在 Vercel，仓库根目录即站点根目录。

- 推送 `main` 分支后 Vercel 自动构建部署
- 需要上传的文件：`index.html`、`assets/`、`js/`、`whale.png`
- **不要**提交 `.history/`（已在 `.gitignore` 里）

## 数据库变更

结构改动放在 `supabase/migrations/`，需要在 Supabase Dashboard → SQL Editor 手动执行一次：

- `20261117_project_files.sql` —— `files` 表增加 `project_id` / `uploaded_by`（项目文件功能依赖）

## 账号与登录

- 账号由管理员在 Supabase Dashboard → Authentication → Users 里创建
- 邮箱规则：`用户名@bonvoyage.click`，登录时只填用户名
- 创建时**必须勾选 Auto Confirm User**
- 自助注册应在 Authentication → Providers → Email 里关闭
- 用户登录后可在「用户中心 → 安全」修改自己的密码

## 相关文档

| 文档 | 内容 |
|---|---|
| [项目结构.md](项目结构.md) | 每个 js 文件的职责、修改规则、脚本加载机制 |
| [SUPABASE_QQ_LOGIN.md](SUPABASE_QQ_LOGIN.md) | QQ 登录接入：QQ 互联配置、云函数部署、密钥设置 |

## 技术约束

1. 除 Supabase SDK 外，其余 js 都是**普通脚本**，共享全局作用域，不要写 `import/export`
2. `js/` 下文件的 `<script defer>` 顺序不能调整
3. 前端只使用 publishable key；`service_role` key 绝不能出现在本仓库
