---
title: RustInPractice TUI（01）：终端窗口与事件循环
date: 2026-07-24 09:00:00
cover: /images/cover/rust/tui-window-loop.webp
categories: [RustInPractice]
tags: [Rust, 编程, 2026, TUI, Terminal, Turbo-Vision]
---

终端 UI 不是把 `println!` 拼成界面，而是维护一组 View，并在绘制、输入和命令之间循环。这个番外使用 `turbo-vision` 的 Rust 实现，从一个可关闭的窗口开始。

<!-- more -->

> 对应 `turbo-vision/hello_window`。以下截图来自 Docker 中实际运行的 100x30 终端帧。

![hello_window 运行截图](/images/rust/tui/hello-window.png)

## 最小结构

`Application::new()` 初始化终端和 Desktop。窗口由 `WindowBuilder` 创建，再向其中加入 Label 和 Button。`Rect::new(x1, y1, x2, y2)` 使用的是两个对角点，不是宽高。

```rust
let mut app = Application::new()?;
let mut window = WindowBuilder::new()
    .bounds(Rect::new(15, 5, 65, 16))
    .title("Hello Turbo Vision")
    .build();

window.add(Box::new(LabelBuilder::new()
    .bounds(Rect::new(2, 2, 46, 2))
    .text("Welcome to turbo-vision for Rust!")
    .build()));
app.desktop.add(Box::new(window));
```

## 绘制与事件

demo 使用手动循环，因此可以看清顺序：先画 Desktop 和状态栏、刷新终端、轮询事件，再把事件交给状态栏和 Desktop。按钮产生的 `CM_OK` 与 `CM_QUIT` 都在最外层决定是否退出。

```rust
while app.running {
    app.desktop.draw(&mut app.terminal);
    app.terminal.flush()?;
    if let Ok(Some(mut event)) = app.terminal.poll_event(timeout) {
        app.desktop.handle_event(&mut event);
        if event.command == CM_OK || event.command == CM_QUIT {
            app.running = false;
        }
    }
}
```

## 运行与边界

```bash
cargo run -p hello_window
```

需要真实 TTY；非交互 CI 适合执行 `cargo build`，不适合启动并等待人工退出。当前窗口坐标为教学用固定值，实际程序应根据终端尺寸调整布局，并为过小终端提供明确提示。

下一篇：模态对话框、输入框和表单状态。
