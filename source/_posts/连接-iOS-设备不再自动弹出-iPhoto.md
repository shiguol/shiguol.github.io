title: 连接 iOS 设备不再自动弹出 iPhoto
uuid: 37fd7e4f-e775-458c-5cf7-cdf88e5fc077
date: 2016-03-17 10:01:12
categories:
- 生活

tags:
- iOS
- iPhoto

---

在 Terminal 中执行：

```
defaults -currentHost write com.apple.ImageCapture disableHotPlug -bool true
```
