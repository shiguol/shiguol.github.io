---
title: RustInPractice TUI（04）：列表、焦点与选择反馈
date: 2026-07-24 12:00:00
cover: /images/cover/rust/tui-list-focus.webp
categories: [RustInPractice]
tags: [Rust, 编程, 2026, TUI, Terminal, Turbo-Vision]
---

列表控件把“当前选择”从一串散落的按键判断中抽离出来。`ListBox` 负责导航和滚动，应用只在收到选择命令时读取选中项并决定下一步。

<!-- more -->

> 对应 `turbo-vision/list_widgets`。截图展示了可用方向键、翻页键和 Enter 操作的初始列表。

![list_widgets 运行截图](/images/rust/tui/list-widgets.png)

## 数据与选择命令

列表由控件持有项目，并在 Enter 确认时发出专用命令。这样事件循环不需要自行维护索引。

```rust
const CMD_LIST_SELECT: u16 = 101;

let mut listbox = ListBoxBuilder::new()
    .bounds(Rect::new(4, 3, 36, 16))
    .on_select_command(CMD_LIST_SELECT)
    .build();
listbox.set_items(vec!["Rust".into(), "C++".into(), "Python".into()]);
```

## 事件顺序

绘制时需要同时画 Desktop、ListBox 与状态栏。收到普通键盘事件后交给 `listbox.handle_event`；若事件被转换成 Command，再读取 `get_selected_item()` 并显示反馈。

```rust
if event.what != EventType::Nothing && event.what != EventType::Command {
    listbox.handle_event(&mut event);
}
if event.command == CMD_LIST_SELECT {
    let message = listbox.get_selected_item()
        .map(|item| format!("You selected: {item}"))
        .unwrap_or_else(|| "No item selected".into());
    message_box(&mut app, &message, flags);
}
```

## 运行与边界

```bash
cargo run -p list_widgets
```

demo 项目数很少。真实数据源应处理空列表、异步加载、选择失效和窄终端裁切；不要假定任何索引都始终有效。

下一篇：多窗口、z-order 与桌面行为。
