# 王者之剑 - Vault Chat 部署指南

## 已完成

- [x] 项目脚手架（vault-chat/）
- [x] 后端 API（GitHub API + Claude 流式对话）
- [x] 前端界面（登录、笔记浏览/查看/编辑、AI 对话、设置）
- [x] PWA 配置（manifest、Service Worker、图标）
- [x] 本地同步脚本（sync-push.ps1）

## 待你手动完成

### 第一步：安装 Git

1. 下载 https://git-scm.com/download/win
2. 安装时全部默认，确保勾选 **Add to PATH**
3. 重启终端，验证 `git --version`

### 第二步：注册 GitHub

1. 访问 https://github.com/signup → 注册 + 验证邮箱
2. 创建私有仓库：https://github.com/new
   - 名称：`obsidian-vault`
   - 选 **Private**
   - 不勾选 README
3. 生成 Personal Access Token：
   - https://github.com/settings/tokens?type=beta
   - 点 "Generate new token (fine-grained)"
   - Repository access: Only select `obsidian-vault`
   - Permissions: Contents → Read and write
   - 复制 token（只显示一次！）

### 第三步：申请 Claude API Key

1. 访问 https://console.anthropic.com/
2. 注册 → Settings → API Keys → Create Key
3. 需绑定信用卡（支持国内双币卡），Haiku 极便宜

### 第四步：注册 Vercel

1. 访问 https://vercel.com/signup
2. 用 GitHub 账号登录（免注册）

### 第五步：初始化 Git 仓库

在 `D:\Obsidian\王者之剑` 目录打开终端：

```powershell
# 配置 Git 用户
git config user.name "你的名字"
git config user.email "你的邮箱"

# 添加远程仓库（替换你的用户名）
git remote add origin https://github.com/你的用户名/obsidian-vault.git

# 首次提交并推送
git add -A
git commit -m "初始提交：知识库笔记"
git push -u origin main
# 输入 GitHub 用户名和刚生成的 PAT（不是密码）
```

### 第六步：部署到 Vercel

```powershell
# 安装 Vercel CLI
npm i -g vercel

# 进入项目目录
cd D:\Obsidian\王者之剑\vault-chat

# 登录（用 GitHub 账号）
vercel login

# 首次部署
vercel --prod
```

### 第七步：配置 Vercel 环境变量

在 Vercel 控制台 → 你的项目 → Settings → Environment Variables：

| 变量名 | 值 |
|--------|-----|
| `GITHUB_TOKEN` | 你的 GitHub PAT |
| `GITHUB_OWNER` | 你的 GitHub 用户名 |
| `GITHUB_REPO` | obsidian-vault |
| `GITHUB_BRANCH` | main |
| `CLAUDE_API_KEY` | 你的 Claude API Key |
| `APP_PASSWORD` | 你想设置的登录密码 |

配置后重新部署：

```powershell
vercel --prod
```

### 第八步：手机使用

1. 手机浏览器打开 `xxx.vercel.app`
2. 输入密码登录
3. 华为浏览器菜单 → "添加到桌面" → 即可当 App 用

### 第九步：配置自动同步（二选一）

**方案 A（推荐）：Obsidian Git 插件**
- Obsidian → 设置 → 第三方插件 → 浏览 → 搜索 "Obsidian Git"
- 安装 → 启用 → 设置自动备份间隔 30 分钟

**方案 B：任务计划程序**
1. 打开"任务计划程序"
2. 创建基本任务 → 触发器：每 30 分钟
3. 操作：启动程序 → `powershell.exe`
4. 参数：`-ExecutionPolicy Bypass -File "D:\Obsidian\王者之剑\vault-chat\scripts\sync-push.ps1"`

## 验证清单

- [ ] 电脑编辑笔记 → 手机能看到更新
- [ ] 手机搜索笔记 → 返回正确结果
- [ ] 手机与 Claude 对话 → 回答正确
- [ ] 手机保存聊天到笔记 → 电脑能看到
- [ ] "添加到桌面" → 图标和启动正常
- [ ] 断网后打开 App → 缓存页面可用
