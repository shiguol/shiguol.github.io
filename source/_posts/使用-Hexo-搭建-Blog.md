title: 使用 Hexo 搭建 Blog
uuid: 9719114b-e718-be4e-9cfe-4418b408b83d
date: 2015-12-13 14:47:57
categories:
- 编程

tags:
- hexo 
- github

cover: images/cover/hexo.png

---

![HEXO-logo](https://avatars0.githubusercontent.com/u/6375567?v=3&s=200)

#### 需求：

有的同学平时会记录和分享一些工作、生活中遇到的问题的解决方法，有的使用各种本地笔记软件，有的使用一些公共空间进行发布；这些方法有各自各样的短板，例如查询、检索麻烦，不方便分享等，笔者通过 GiTHuB pages 及 Hexo 为例，讲解一种在线笔记搭建的方法。

#### 准备：
- Github 账号；
- Node.js 环境；
- Git 命令行；



#### 步骤：
```
1.创建以自己 github 账号名为仓库的一个 github 仓库；

2.安装 Hexo blog；

3.下载自己喜欢的 theme；

4.更改 hexo 配置；

5.启动、测试本地 hexo 状态；

6.发布到 github 仓库；

```

#### Hexo 常用命令：

1.`hexo n "my_article"` #新建文章

2.`hexo clean` #清除缓存

3.`hexo g` #生成

4.`hexo s` #预览

5.`hexo d` #发布


#### Hexo 升级
```
:升级 hexo：
npm i hexo-cli -g

npm update

:重新安装 npm package：
rm -rf node_modules/
npm i --no-optional
```
