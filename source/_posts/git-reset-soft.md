title: git_reset_soft
uuid: cde38b17-bb52-6923-fd30-5f4287be9dff
date: 2017-08-12 16:10:25

categories:
- 编程

tags:
- git

cover: https://git-scm.com/images/logos/downloads/Git-Logo-2Color.png

---
例如在当前分支提交过 3 次，希望合并为 1 次提交，可以执行如下指令：

```
#git reset --soft HEAD~3
#git commit -m "final commit message"
#git push ogirin -f
```

