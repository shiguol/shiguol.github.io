title: Mac_develop_tool_chain
uuid: 7ac5d1dd-dc12-9d8e-e884-ca571ec474f0
date: 2016-01-07 17:03:03
categories:
- 编程

tags:
- 2016
- Mac

cover: https://upload.wikimedia.org/wikipedia/commons/c/c9/Finder_Icon_macOS_Big_Sur.png

---

![brew-logo](https://avatars2.githubusercontent.com/u/1503512?v=3&s=200)

## Mac OS X 不可或缺的套件管理器

使用 Mac OS X 进行开发，除了在 App Store 下载安装一些 .app 之后，不可避免地会使用一些命令行工具，例如 `npm(Node.js)`,`git(Git)` 等，如果这些命令行工具也可以有一个统一的『官方』下载地址，并且可以方便地安装、升级、卸载就好了，今天介绍的这两个『命令行工具管理器』是目前比较流行的两个包管理器。

### brew

brew 是一个包管理器，常见的工具 `git`, `node.js` , `gradle`, `carthage` 等工具都可以在 `brew` 中进行安装和升级。

使用 

```
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

```
安装 brew;

brew 常见命令有以下：

```
brew outdated #检查是否有新版本
brew upgrade #更新
brew install git #安装 git
brew uninstall git #卸载 git
brew search git #查找 git
brew cleanup #删除重复的版本
```

接下来介绍另一款包管理器：gem

### gem

gem 是另一个包管理器，通常用来管理 `cocoapods`, `noman-cli` 等 Mac 相关的命令行工具；通常系统自带有 gem 管理器，常见命令有以下：

```
sudo gem update --system #更新自身
gem install #安装
gem search #查找
sudo gem cleanup #删除冗余版本

#一些需要指定非系统级侵入安装
sudo gem install -n /usr/local/bin cocoapods

```

EOF.