---
title: RustInPractice TUI（02）：模态表单与 UI 状态
date: 2026-07-24 10:00:00
cover: /images/cover/rust/tui-modal-form.webp
categories: [RustInPractice]
tags: [Rust, 编程, 2026, TUI, Terminal, Turbo-Vision]
---

表单的难点不是画两个输入框，而是让输入状态在控件和提交逻辑之间保持一致。`dialog_form` 用模态 Dialog 暂时接管事件循环，并用共享数据保存输入。

<!-- more -->

> 对应 `turbo-vision/dialog_form`。截图中的姓名和邮箱均为 demo 固定示例数据。

![dialog_form 运行截图](/images/rust/tui/dialog-form.png)

## 状态归属

`InputLine` 接收 `Rc<RefCell<String>>`。`Rc` 允许输入框和提交代码共同持有同一份字符串，`RefCell` 把借用检查放到运行时。这个组合只适合单线程 UI 状态；跨线程更新应使用消息通道或同步原语。

```rust
let name_data = Rc::new(RefCell::new(String::from("Alice")));
dialog.add(Box::new(
    InputLineBuilder::new()
        .bounds(Rect::new(14, 3, 44, 3))
        .max_length(28)
        .data(Rc::clone(&name_data))
        .build(),
));
```

## 模态结果

先调用 `set_initial_focus()`，再用 `execute(&mut app)` 进入模态循环。只有结果为 `CM_OK` 时才读取数据并展示提交结果，取消则不产生副作用。

```rust
dialog.set_initial_focus();
let result = dialog.execute(&mut app);
if result == CM_OK {
    let message = format!("Submitted: {}", name_data.borrow());
    message_box(&mut app, &message, MF_INFORMATION | MF_OK_BUTTON);
}
```

## 运行与边界

```bash
cargo run -p dialog_form
```

输入长度在控件层限制为 28，但这不是业务校验。真实表单仍需在提交边界校验必填项、格式和允许范围，并避免把用户输入直接写入日志或截图。

下一篇：菜单栏、状态栏与命令路由。
