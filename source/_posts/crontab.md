title: crontab
uuid: 002b78ef-6e4c-7572-783a-aa5b4a61b42e
date: 2017-07-20 14:19:23

categories:
- 编程

tags:
- linux

---

定时任务命令使用：
```
$ crontab -l
$ crontab -e

* * * * * rm /home/someuser/tmp/*

*  *   *  *  *    // 5个都是个星号，代表每分钟都会执行。 
30 *   *  *  *    // 每到 30 分的时候执行一次，也就是每小时执行两次。
*  18  *  *  *    // 每天的 18 点执行一次。
*  */2 *  *  *    // 每隔 2 小时执行一次， */ 是间隔时段的表示法。

```

