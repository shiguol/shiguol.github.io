title: Crontab 定时任务
date: 2025-05-19 00:10:25
categories: Linux
tags:
---

crontab -e

crontab -l

*/30 * * * * ps -ef | grep debugserver | xargs kill

每 30 分钟 kill hang 掉的进程


