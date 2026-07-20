---
title: RustInPractice TUI（03）：菜单、状态栏与命令路由
date: 2026-07-24 11:00:00
cover: /images/cover/rust/tui-command-routing.webp
categories: [RustInPractice]
tags: [Rust, 编程, 2026, TUI, Terminal, Turbo-Vision]
---

菜单、快捷键和状态栏不应各自执行业务逻辑。它们都应转成统一命令，再由一个边界明确的分发点处理。`menu_status` 演示了这条链路。

<!-- more -->

> 对应 `turbo-vision/menu_status`。启动时的 About 对话框展示了菜单和状态栏都已绘制。

![menu_status 运行截图](/images/rust/tui/menu-status.png)

## 定义命令

内置命令如 `CM_NEW`、`CM_OPEN` 和 `CM_QUIT` 可直接使用；应用自己的命令应避开内置范围。

```rust
const CMD_ABOUT: u16 = 100;

let help_menu = SubMenu::new(
    "~H~elp",
    Menu::from_items(vec![MenuItem::with_shortcut(
        "~A~bout", CMD_ABOUT, 0, "F1", 0,
    )]),
);
```

## 单一分发点

事件循环先把 Ctrl-N、Ctrl-O、Alt-X 映射为 Command 事件，再依次交给菜单栏和状态栏处理，最后只在 `handle_command` 中改变应用状态或打开对话框。

```rust
if event.what == EventType::Command {
    match event.command {
        CM_QUIT => app.running = false,
        CM_NEW => message_box(app, "Create a new file (demo)", flags),
        CMD_ABOUT => show_about(app),
        _ => {}
    }
}
```

这种集中处理让同一动作可以由菜单、快捷键或状态栏热区触发，也便于测试命令到行为的映射。

## 运行与边界

```bash
cargo run -p menu_status
```

菜单项目前只显示 demo 对话框。实际文件操作需要定义失败路径、确认流程和可恢复错误，而不能把 UI 文案当作业务完成。

下一篇：ListBox 的焦点、导航与选择。
