# WALL-E's Blog

基于 [Hexo](https://hexo.io/) 搭建的个人博客，使用 [Butterfly](https://github.com/jerryc127/hexo-theme-butterfly) 主题。

🔗 **网站地址**：https://shiguol.github.io

---

## 📁 仓库结构

本仓库包含两个分支：

| 分支 | 内容 | 说明 |
|-----|------|------|
| `master` | 静态网站文件 | GitHub Pages 自动部署，由 `hexo deploy` 生成 |
| `source` | Hexo 源代码 | 包含文章、配置、主题等所有源文件 |

---

## 🚀 快速开始

### 环境要求

- Node.js (推荐 v18+)
- Git

### 克隆项目

```bash
# 克隆 source 分支
git clone -b source git@github.com:shiguol/shiguol.github.io.git blog-source
cd blog-source

# 安装依赖
npm install
```

---

## ✍️ 写作流程

### 1. 新建文章

```bash
# 创建新文章
npx hexo new "文章标题"

# 文章会创建在 source/_posts/ 目录下
# 例如：source/_posts/文章标题.md
```

新建的文章模板：

```markdown
---
title: 文章标题
date: 2026-01-20 12:00:00
categories:
  - Programming    # 分类
tags:
  - hexo          # 标签
  - 2026
cover: /images/cover/hexo.png  # 封面图（可选）
---

在这里写文章内容...
```

### 2. 本地预览

```bash
# 启动本地服务器
npx hexo server

# 或简写
npx hexo s
```

访问 http://localhost:4000 预览效果。

> 💡 服务器支持热更新，修改文章后会自动刷新。

### 3. 生成静态文件

```bash
# 清理缓存并生成
npx hexo clean && npx hexo generate

# 或简写
npx hexo clean && npx hexo g
```

### 4. 部署到线上

```bash
# 部署到 GitHub Pages
npx hexo deploy

# 或简写
npx hexo d
```

### 5. 提交源码

```bash
# 添加所有更改
git add .

# 提交
git commit -m "新增文章: 文章标题"

# 推送到 GitHub
git push
```

---

## 📋 常用命令速查

| 命令 | 简写 | 说明 |
|-----|------|------|
| `npx hexo new "标题"` | `npx hexo n "标题"` | 新建文章 |
| `npx hexo new page "页面"` | - | 新建页面 |
| `npx hexo server` | `npx hexo s` | 启动本地服务器 |
| `npx hexo generate` | `npx hexo g` | 生成静态文件 |
| `npx hexo deploy` | `npx hexo d` | 部署到远程 |
| `npx hexo clean` | - | 清理缓存和生成文件 |

### 组合命令

```bash
# 一键部署（推荐）
npx hexo clean && npx hexo g && npx hexo d

# 一键部署并提交源码
npx hexo clean && npx hexo g && npx hexo d && git add . && git commit -m "更新博客" && git push
```

---

## 📂 目录结构

```
.
├── _config.yml          # Hexo 主配置文件
├── package.json         # 项目依赖
├── scaffolds/           # 文章模板
│   ├── draft.md         # 草稿模板
│   ├── page.md          # 页面模板
│   └── post.md          # 文章模板
├── source/              # 源文件目录
│   ├── _posts/          # 📝 文章目录（Markdown 文件）
│   ├── about/           # 关于页面
│   ├── categories/      # 分类页面
│   ├── tags/            # 标签页面
│   └── images/          # 图片资源
├── themes/              # 主题目录
│   └── butterfly/       # Butterfly 主题
└── public/              # 生成的静态文件（已忽略）
```

---

## 🎨 文章写作指南

### Front-matter 配置

```yaml
---
title: 文章标题           # 必填
date: 2026-01-20 12:00:00 # 发布日期
updated: 2026-01-21       # 更新日期（可选）
categories:               # 分类（可选）
  - Programming
tags:                     # 标签（可选）
  - hexo
  - blog
cover: /images/xxx.png    # 封面图（可选）
---
```

### 常用分类

- `Programming` - 编程相关
- `Life` - 生活记录
- `Blog` - 博客相关
- `Docker` - Docker 容器
- `Linux` - Linux 系统
- `macOS` - macOS 系统
- `VIM` - VIM 编辑器
- `Hexo` - Hexo 博客

### Markdown 语法

```markdown
# 一级标题
## 二级标题
### 三级标题

**粗体** *斜体* ~~删除线~~

- 无序列表
- 无序列表

1. 有序列表
2. 有序列表

> 引用文字

[链接文字](https://example.com)

![图片描述](/images/xxx.png)

`行内代码`

​```javascript
// 代码块
console.log('Hello World');
​```

| 表头1 | 表头2 |
|-------|-------|
| 内容1 | 内容2 |
```

---

## 🔧 配置说明

### 主配置文件 `_config.yml`

```yaml
# 网站信息
title: WALL-E's Blog
author: SAlex
url: http://shiguol.github.io

# 部署配置
deploy:
  type: git
  repository: git@github.com:shiguol/shiguol.github.io.git
  branch: master
```

### 主题配置

主题配置文件位于 `themes/butterfly/_config.yml`

---

## 🆘 常见问题

### Q: 本地预览正常，但线上显示不正确？

```bash
# 清理缓存后重新部署
npx hexo clean && npx hexo g && npx hexo d
```

### Q: 部署失败？

检查 SSH 密钥是否配置正确：

```bash
ssh -T git@github.com
```

### Q: 如何更新 Hexo 版本？

```bash
npm update hexo
```

### Q: 换电脑后如何恢复？

```bash
git clone -b source git@github.com:shiguol/shiguol.github.io.git blog-source
cd blog-source
npm install
npx hexo server
```

---

## 📝 更新日志

- **2026-01-20**: 初始化源码版本控制，添加 README 文档
- **2025-05-19**: 升级 Hexo 到 7.3.0，更换 Butterfly 主题

---

## 📄 License

本博客内容采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可协议。
