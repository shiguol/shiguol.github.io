---
title: RustInPractice TUI（05）：多窗口与桌面行为
date: 2026-07-24 13:00:00
cover: /images/cover/rust/tui-desktop-windows.webp
categories: [RustInPractice]
tags: [Rust, 编程, 2026, TUI, Terminal, Turbo-Vision]
---

多窗口 UI 的核心不是同时创建多个窗口，而是让前后层级、点击激活、拖动和关闭都由 Desktop 统一维护。`desktop_showcase` 用三个重叠的非模态窗口展示这一点。

<!-- more -->

> 对应 `turbo-vision/desktop_showcase`。截图来自实际运行状态，最晚加入的窗口位于最前。

![desktop_showcase 运行截图](/images/rust/tui/desktop-showcase.png)

## 建立层级

窗口依次加入 Desktop，后加入的窗口在初始状态位于前方。每个窗口的文本 View 只关心客户区，窗口移动、激活和关闭交给框架。

```rust
app.desktop.add(Box::new(make_window(
    Rect::new(4, 2, 44, 12),
    "Window 1 - Background",
    "Non-modal window.",
)));
app.desktop.add(Box::new(make_window(
    Rect::new(32, 4, 74, 15),
    "Window 3 - Foreground",
    "Topmost after creation.",
)));
```

## 让框架运行循环

前几篇为教学目的手动绘制和分发事件；这里使用 `app.run()`。内置循环负责事件分发、局部重绘、关闭窗口清理和 Alt-X 退出。

```rust
app.run();
```

手动循环适合需要插入自定义调度策略的场景；若没有额外需求，优先使用框架循环，减少遗漏重绘或清理的机会。

## 运行与收官

```bash
cargo run -p desktop_showcase
```

固定窗口坐标在小终端会重叠或超出边界，因此本番外只验证了 100x30 终端下的布局。实际产品应根据当前尺寸重新排版，并为最小可用尺寸提供降级方案。

RustInPractice 的 TUI 番外至此完成：应用循环、模态状态、命令路由、控件选择与多窗口桌面共同构成了一个可继续扩展的终端应用骨架。
