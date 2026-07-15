---
cover: /images/cover/git-gitignore.webp
title: 使用全局 .gitignore
uuid: bc5f9230-f714-c855-bef2-668b6c65903d
date: 2016-03-17 10:04:02
categories:
- Programming

tags:
- Git
- gitignore
- 版本控制
---

!!Deprecated!!

全局配置 .gitignore 之后，新建仓库，可以默认让 iOS 及 Android 项目生效：

```
git config --global core.excludesfile=/path/to/global_git_ignore/.gitignore

```

另外，在 [https://www.gitignore.io/](https://www.gitignore.io/) 可以配置其它 .gitignore 文件。

