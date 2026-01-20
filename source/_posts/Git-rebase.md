title: Git rebase
date: 2025-05-19 00:08:34
categories: Programming
tags: Git
---

如果你正在 feature 分支上合作开发，并且你追踪的是上游的 feature 分支，当你要提 pr 时，发现落后 master 分支若干次提交，

那么，你可以这样：


```
# 之前 feature ==> upstream/feature

# step 1
git branch -u upstream/dev

# 这时，在终端你可以看到 feature 分支落后 master 若干次提交；
# step 2
git pull -r

# 如果没有冲突，你可以看到已经和 master 分支对齐了
# 如果有冲突，可以解冲突、add、git rebase --continue 继续，直至全部对齐为止

# step 3
# 推到上游即可
git push upstream -f 

# step 4
# 再切回追踪的 feature 为上游
git branch -u upstream/feature
```

