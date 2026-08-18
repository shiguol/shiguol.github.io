---
cover: /images/cover/ai/needle2-tool-call.webp
title: "Needle 2 技术分析：一个 14 MB 的端侧 Tool Call 引擎"
date: 2026-08-18 20:01:27
categories:
  - AI
tags:
- AI
- 编程
- 2026
- 端侧模型
- 工具调用
- iOS
- Schema 设计
---

> 本文基于实测数据，覆盖架构原理、Schema 设计规律、iOS 集成，以及一次把 3 类设备扩到 22 类的完整实验记录。

我最近在做一个 iOS 家电控制 Demo，核心需求是：**在手机上、离线、实时响应自然语言指令**。用一个大模型的 API 当然能做，但那不是这个 Demo 想探索的东西。

选到 needle2 是因为它把「工具调用」这件事做到了极致的轻量：45M 参数、单一 14 MB 二进制（权重也在里面）、单次会话峰值 RAM 28 MB（官方宣称；后文会给出实测数字）、Apache-2.0 许可。

<!-- more -->

## 一、背景

needle2 在树莓派 5 上跑 500 tok/s，Apple Vision Pro 上跑 400–1500 tok/s。它不是「小一号的通用 LLM」，而是一个专门为 function call 场景设计的模型。

这篇文章是我在做这个 Demo 过程中积累的分析，从架构原理到踩坑细节，全部基于实测。

## 二、架构：Simple Attention Network（SAN）

needle2 的架构来自 2025 年的一篇论文：[arXiv:2607.18363](https://arxiv.org/abs/2607.18363)《A Controlled Study of Attention-Only Transformers》。

核心问题是：**FFN（前馈网络）是 Transformer 里真的必要的吗？**

FFN 大约占了一个标准 Transformer 三分之二的非嵌入参数。这篇论文设计了严格控制参数量、计算量和深度的对照实验，跨越 6M–87M 参数、最多 105B tokens 的训练量：

| 情况 | 结论 |
|---|---|
| naive 去掉 FFN，不补偿深度 | 每 token loss 差 0.47 nats |
| 去掉 FFN，把参数预算补进更多注意力层 | 差距缩到 **0.006 nats**（只差 0.27%）|
| 残差差距集中在哪里 | 参数化知识召回（parametric recall），不是推理 |

**QK-normalization 是关键成分**——没有它，48 层纯注意力栈根本训不稳。FFN 本身不是必须的。

needle2 在这个基础上做了几个工程化改动：

- **Hadamard MLP**：用 Walsh-Hadamard 变换代替 FFN，O(n log n) 时间、零参数，数学上等价于一种正交投影
- **Engram KV memory**：从哈希 n-gram 表里动态查出 (k, v) 对，用 Sinkhorn 归一化的双随机矩阵 P 路由，只在两个固定层触发
- **Sandwich norm + 残差门控**
- **GQA attention**：分组查询注意力，减少 KV cache

词表只有 **8192 个 token**（对比 GPT-4o 的 100K+）。这不是缺陷，而是设计取舍：8K 词表 + 2-bit 量化 = 14 MB 二进制，足够覆盖英文的 function call 场景。

## 三、为什么它是 Tool Call 专用模型

needle2 的行为和通用 LLM 有根本差异，必须先理解这一点才能用好它。

### 1. 没有自由文本回复通道（除了 respond 类型）

```json
{
  "type": "tool_call",
  "function_calls": [
    {"name": "set_light", "arguments": {"room": "living_room", "power": "on"}}
  ],
  "reasoning": "User wants to turn on the light in the living room.",
  "confidence": 0.86,
  "prefill_tps": 2366,
  "decode_tps": 1074,
  "peak_ram_mb": 232
}
```

每次推理输出的都是这个结构。无法处理的请求返回空调用 `[]`，不是错误，是拒绝。

### 2. Grammar-Constrained Decoding

Schema 里的 enum 值会被编译进字节级语法约束，模型物理上无法输出范围外的值。温度、亮度的 min/max 也会编译进去。**JSON 格式错误不可能发生**，只有 `reasoning` 字段是无约束生成的。

### 3. System prompt 不是指令，是事实

```
date: 2026-08-18 Tue 14:30; locale: zh-CN; device: phone; battery: 62%
```

可识别的 key 只有 `date / locale / device / battery / network / location / user / assistant`。写进去的「你是一个智能家居助手」之类的句子会被**忽略**，工具的 description 才是唯一的行为控制面。

官方的总结：**"describing them well is the whole game."**

### 4. 256-token 滑动窗口，Tools 作为 KV sink

工具定义被常驻在窗口的前端（KV sinks），会话内容在后端滑动。会话内容可以无限长，但 RAM 始终接近恒定。

## 四、iOS 集成：比想象中简单很多

C API 只有 4 个函数：

```c
int  needle_init(const char* system_prompt,
                 const char* tools_json,
                 const char* tool_index_path);
int  needle_complete(const char* input, int max_new_tokens,
                     char* out, int out_capacity);
void needle_reset(void);
int  needle_load(const unsigned char* cact, unsigned long long n);
```

没有句柄，没有流式回调，没有生命周期管理。一个进程一个全局单例会话。

获取 iOS 静态库：

```sh
pip install cactus-needle
needle download ios-arm64      # libneedle.a (14.17 MB) + needle.h
needle download ios-sim-arm64  # 模拟器版
```

权重是直接内嵌在 `.a` 里的：

```
$ ar x libneedle.a && ls -la *.o
needle_embed.S.o    13.10 MB   ← 权重，以汇编 blob 编译进去
needle.cpp.o         0.38 MB   ← 推理代码
```

App 不需要任何额外的模型文件，不需要下载，不需要调 `needle_load`。最终 Debug 包只有 **14 MB**，其中 13.1 MB 是模型本身。

### 两个容易踩的坑

**返回码契约**：`< 0` 才是失败，不是 `!= 0`。`needle_init` 的正数返回值代表 prompt token 数，不是错误码。按 C 惯例写成 `rc == 0` 会把每次成功都当成失败——真机第一次跑就踩了，报「needle_init 失败，返回码 536」。

**Deployment target**：`otool -l` 显示两个静态库的 `minos` 都是 26.5（iOS 26.5 / macOS 26.5）。这是全项目最硬的约束，Xcode 工程的 deployment target 必须跟着设。

## 五、Schema 设计：这才是重头戏

这是 needle2 和通用 LLM 最大的差异点：**所有的 prompt engineering 都在 Schema 的 description 里**，而不是 system prompt 里。

我做了从 3 类设备扩到 22 类的完整实验，用例集 32 条，最终达到 31/32（97%）。过程中发现了 8 条可复用的规律。

### 规律 1：禁用 boolean，开关一律用 enum

```json
// ❌ 错的
{"name": "power", "type": "boolean"}

// ✅ 对的
{"name": "power", "type": "string", "enum": ["on", "off"]}
```

原因：可选 boolean 的 `false` 值在 needle2 内部被当作「无证据」而省略，导致整个调用塌成空调用 `[]`。两条关机指令（`turn off the bedroom AC`、`turn off the study light`）就是这样失败的，改成 enum 后立刻修复，confidence 从 0.00 跳到 0.61/0.77。

### 规律 2：禁用数值表达方向性语义

```json
// ❌ 错的（模型不会读 description 里的 "0 = fully closed"）
{"name": "position", "type": "integer", "minimum": 0, "maximum": 100}

// ✅ 对的
{"name": "position", "type": "string", "enum": ["closed", "half", "open"]}
```

测试时 `open the living room curtain all the way` 输出了 `position: 0`，语义完全反了。模型根本没有从 description 里读懂「0 = 全关，100 = 全开」这个约定。离散化能解决的就不要用连续值。

### 规律 3：业务上必须有的字段设为 required

不要指望模型自己补。

### 规律 4：enum 有首值偏置 ⭐

```json
// ❌ 这个顺序下，close the curtain 会返回空调用
{"enum": ["open", "half", "closed"]}

// ✅ 把最容易被漏掉的值放第一位
{"enum": ["closed", "half", "open"]}
```

诊断过程：把 `closed` 改名成 `shut`，模型开始调工具了，但吐的是 `"open"`——enum 的第一个值。**模型不确定时会退回首值，或者干脆不吐任何值**。把 `closed` 移到第一位后，27/32 提升到 29/32。

### 规律 5：拆分优于合并 ⭐

| 方案 | 准确率 |
|---|---|
| 5 个工具，13 种设备合进一个 enum | 19/32 |
| 7 个工具，按设备类型拆分 | 26/32 → 31/32（加其他优化后）|

**模型靠工具名路由**，把所有设备塞进一个 enum 等于把路由信息藏起来了。宁可多开一个工具，也别把异类设备堆在一起。

### 规律 6：每个 set_* 工具必须有必填的设备选择器

```json
// ❌ 危险：这个工具形状太泛，会吸走不相关的指令
{
  "name": "set_camera",
  "parameters": {
    "room": {"type": "string", "enum": [...]},
    "power": {"type": "string", "enum": ["on", "off"]}
  }
}

// ✅ 加设备选择器 enum
{
  "name": "set_camera",
  "parameters": {
    "camera": {
      "type": "string",
      "enum": ["living_room_camera", "bedroom_camera", ..., "outdoor_camera"]
    },
    "power": {"type": "string", "enum": ["on", "off"]}
  }
}
```

早期 `set_camera` 只有 `room + power`，形状太泛，把「关掉书房空调」「启动浇花机器人」都吸走了。加了 `camera` 这个必填 enum 后问题消失。

### 规律 7：Schema 越短越准

这是所有规律里最反直觉的一条。

消融实验：把描述精简（3915 → 3103 字节，工具数不变），21/32 直接跳到 26/32。**每多一个字节都在挤压 256-token 窗口里的推理预算**，不要往 description 里堆无意义的说明文字。

### 规律 8：工具排列顺序有位置偏置 ⭐

枚举了三个新工具的 6 种排列，成绩从 28/32 到 31/32：

| 顺序 | 32 条 |
|---|---|
| robot → camera → kitchen_appliance | **31/32** |
| robot → kitchen_appliance → camera | **31/32** |
| camera → robot → kitchen_appliance | 30/32 |
| kitchen_appliance → camera → robot | 30/32 |
| kitchen_appliance → robot → camera | 29/32 |
| camera → kitchen_appliance → robot | 28/32 |

**排在中间的工具会变成「匹配不上时的接盘侠」**。工具顺序不要凭直觉排，要实测。

## 六、Retrieval 阈值实测

官方文档说超过 5 个工具会触发 tool retrieval，工具定义不再整体进 prompt，改为按 query 召回 top-5。这个阈值我用 `needle_init` 的返回值（= prompt token 数）直接验证了：

| 工具数 | `needle_init` 返回值 |
|---|---|
| 3 | 370 |
| 4 | 511 |
| 5 | 640 |
| **6** | **1** ← 突变 |
| 7 | 1 |

**阈值是真的**。6 个工具开始，返回值从 640 直接掉到 1，工具定义没有进 prompt，引擎自动切到了 retrieval 模式（不需要传 `tool_index_path`，它自己会建索引）。

但当初担心的「未选中工具不可达」**没有出现**：7 工具下 31/32，32 条用例覆盖了全部 7 个工具，没有任何一个工具因为没被召回而失败。

副作用反而是正面的：retrieval 模式下 prompt 里不再堆全部工具定义，256-token 窗口的压力反而小了。

> ⚠️ 只验证到 7 个工具。更多工具时 retrieval 的召回率会不会下降，没有测。每次加工具都要重跑 bench。

## 七、中文不可用的根因

实测中文 tool call 准确率约 10%，根因是**词表里没有汉字**：

```
vocab 总数：8192
含中日韩汉字的 token 数：0
byte fallback token 数：256
```

一个汉字被拆成 3 个 UTF-8 字节 token，256-token 的窗口实际只能装约 85 个汉字。模型的 reasoning 输出全是英文，说明它在内部完全在英文空间工作。

失败模式是退化到先验概率最高的那条路径——无论输入什么，都返回 `query_device_status{room: "living_room", device: "air_conditioner"}`。

解决方案：UI 用中文，指令用英文。不适合在端侧做翻译层（和「离线」的核心卖点冲突）。中文硬需求出现时，建议退回 Qwen3-0.6B 这类中文预训练模型，而不是对 needle2 做 fine-tune（词表里没有汉字，fine-tune 相当于从字节重学语义）。

## 八、Confidence 不适合做门控

原计划用 confidence 阈值过滤错误调用。实测证明完全不可行：

| 输入（全部正确执行） | confidence |
|---|---|
| open the living room curtain all the way | 0.95 |
| close the bedroom curtain | 0.40 |
| is the study light on | 0.02 |
| set the study AC to 22 | 0.00 |
| what's the status of the living room AC | 0.00 |

同一批全对的调用里，confidence 从 0 到 0.95 都有。任何阈值都会误杀大量正确调用。官方宣称「calibrated confidence score」在本任务的 schema 上没有表现出与正确性的相关性。

**不要用它做门控**。它唯一有参考价值的场景是空调用（拒绝），说明模型觉得当前没有任何工具能处理这个请求。

## 九、性能实测

| 平台 | decode_tps | peak_ram_mb | 备注 |
|---|---|---|---|
| Mac (Apple Silicon) | 1104 tok/s | 50 MB | Python wrapper，7 工具 |
| iPad 模拟器 (M4) | 864–1074 tok/s | 223–232 MB | iOS 26.x，同一条指令 |
| 树莓派 5 | ~500 tok/s | — | 官方数据 |
| 真机 | 待测 | 待测 | |

RAM 这个数字有点令人困惑——官方宣称 28 MB，Mac 上实测 50 MB，iPad 模拟器上 223–232 MB，差了一个数量级。模拟器不等于真机，真机数据待补充。可能的解释是模拟器的内存统计方式包含了更多运行时开销。

## 十、Demo 最终状态

工具集（7 个，顺序载荷相关，别随意调整）：

```
set_air_conditioner → set_light → set_curtain → set_robot
→ set_kitchen_appliance → set_camera → query_device_status
```

32 条用例 **31/32（97%）**，12 条回归全过。唯一失败项：`turn off the microwave` 被 `set_camera` 接走（微波炉没有对应的设备选择器 enum 作为区分信号）。

iOS 工程 14 MB，SwiftUI，无网络，无第三方依赖，iOS 26.5+。

## 总结

needle2 不是一个缩小版的通用助手，它是一个为 function call 特化的推理引擎。拿来做需要模糊理解、多轮推理、或中文支持的任务会很痛苦，但对于**英文指令 → 结构化工具调用**这个场景，在 14 MB 的体积约束下，它做到了令人意外的可用性。

最大的学习是 Schema 设计本身的重要性：enum 首值偏置、工具排列顺序偏置、每个字节都是推理预算——这些都是在通用 LLM 上完全不需要关心的问题。针对模型的解码机制设计 Schema，比调 prompt 要有效得多。

---

- 论文：[arXiv:2607.18363](https://arxiv.org/abs/2607.18363)《A Controlled Study of Attention-Only Transformers》
- 模型：[Cactus-Compute/needle2](https://huggingface.co/Cactus-Compute/needle2)（Apache-2.0）
- 实验脚本为本地私有工程，未开源
