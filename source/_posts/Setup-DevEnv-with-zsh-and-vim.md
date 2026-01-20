title: Setup DevEnv with zsh and vim
uuid: cd6170d7-fb25-61f6-f6a4-48c32d6a0a67
date: 2016-04-18 10:41:56
categories:
- 编程

tags:
- zsh
- vim

cover: https://commons.wikimedia.org/wiki/Category:Terminal_icons#/media/File:GNOME_Terminal_icon_2019.svg

---

今天拿到了新电脑，本来想做迁移，回头又一想，不如重新配置一个开发环境，因为有了此文。

先介绍一下我的开发设备及配置的一些环境：

硬件设备：

- Thinkpad T450;
- Dell U2315;

软件开发环境：

- Ubuntu 14.04 LTS;
- zsh;
- vim;
- git;

---

其中 zsh 安装及配置如下：

- 安装：

```
wget https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh -O - | sh

```


- 配置：


```
# 主题
ZSH_THEME="jispwoso"

# 中文支持
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 颜色
export LSCOLORS="exfxcxdxbxexexabagacad"

```


---


vim 配置如下：


```
set number

color elflord

syntax on

filetype plugin indent on

```

---

git 全局配置如下：

```
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    slog = 'log --pretty=format:"%h-%an,%ar:%s" --graph --color=always'
```


EOF.
