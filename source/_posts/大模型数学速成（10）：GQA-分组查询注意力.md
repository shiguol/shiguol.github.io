---
cover: /images/cover/ai/gqa.png
title: 大模型数学速成（10）：GQA——分组查询注意力
date: 2026-07-08 10:00:00
categories:
  - LLMMathPrimer
tags:
  - AI
  - 数学
  - Transformer
  - 大模型
  - 2026
mathjax: true
---

[第 09 篇](/2026/07/07/大模型数学速成（09）：多头注意力-多个专家各看各的/)的 **MHA** 里，Q、K、V 各有 $h$ 个头——推理时要为**每个 token 缓存全部 K/V 头**，显存随上下文长度线性暴涨。**GQA（Grouped Query Attention，分组查询注意力）** 让多路 Q 共享更少的 K/V 头，在效果接近 MHA 的前提下大幅压缩 **KV Cache**。

这一篇讲清：KV Cache 为何吃显存、GQA 怎么分组共享、以及 MHA / GQA / MQA 对照。

<!-- more -->

> 这是「大模型数学速成」系列的第 10 篇。建议先读 [第 09 篇：多头注意力](/2026/07/07/大模型数学速成（09）：多头注意力-多个专家各看各的/)。下一篇 **KV Cache**（系列收官）。

## 一、KV Cache 显存从哪来？

Decode 阶段每生成一个新 token，都要和**历史上所有 token** 做 Attention（[第 05 篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/)）。历史 token 的 K、V 在 Prefill 时已算过——**存下来复用**，不必每步重算，这就是 **KV Cache**。

每层、每个 token 需缓存：

$$
\text{K 缓存} + \text{V 缓存} \approx 2 \times h_\text{kv} \times d_\text{head} \times S
$$

（$S$ 为当前序列长度，$h_\text{kv}$ 为 **K/V 的 head 数**。）

| 因素 | 影响 |
|------|------|
| 层数 $L$ | 线性倍增 |
| 上下文 $S$ | 线性增长（长对话致命） |
| $h_\text{kv}$、$d_\text{head}$ | head 越多、维越大，Cache 越大 |
| batch / 并发请求 | 再乘 batch 大小 |

**瓶颈**：MHA 中 $h_\text{kv} = h_\text{q} = h$（如 32），**K 和 V 各 32 头全存**——显存大户。

## 二、三种 Attention 头数配置

设 Q 的 head 数为 $h_q$，K/V 的 head 数为 $h_\text{kv}$（可 $\le h_q$）。

| 模式 | $h_q$ vs $h_\text{kv}$ | 直觉 |
|------|-------------------------|------|
| **MHA**（Multi-Head） | $h_\text{kv} = h_q$ | 每个 Q 头配独立 K/V 头 |
| **GQA**（Grouped Query） | $h_\text{kv} = h_q / g$，$g$ 为组大小 | 每 $g$ 个 Q 头 **共享** 1 组 K/V |
| **MQA**（Multi-Query） | $h_\text{kv} = 1$ | 所有 Q 头共享 **同一** K/V（GQA 极端） |

```
MHA:  Q0─K0─V0   Q1─K1─V1   Q2─K2─V2   Q3─K3─V3     （1:1:1）

GQA:  Q0─┐
      Q1─┼─ K0─V0
      Q2─┤
      Q3─┘ K1─V1                              （g=2 时 2 个 Q 共享 1 组 KV）

MQA:  Q0,Q1,Q2,Q3 ─── K0─V0                   （全体共享）
```

代表模型：

- **MHA**：早期 GPT、BERT、ViT
- **GQA**：LLaMA-2 70B、Qwen、许多开源 LLM
- **MQA**：PaLM、部分推理优化模型

## 三、GQA 的数学：共享 K/V，Q 仍多头

与 [第 09 篇](/2026/07/07/大模型数学速成（09）：多头注意力-多个专家各看各的/) 相同，先投影得 $Q, K, V$（形状 `[d, S]`），再分头。

**区别在分头后的 head 个数**：

| 张量 | MHA | GQA 示例（$h_q=8, h_\text{kv}=2$） |
|------|-----|-----------------------------------|
| Q | $h_q$ 个头，各 `[d_head, S]` | 仍 **8** 个头 |
| K | $h_q$ 个头 | **2** 个头 |
| V | $h_q$ 个头 | **2** 个头 |

**分组规则**：Q 头 $i$ 使用 K/V 头 $\lfloor i / g \rfloor$，其中 $g = h_q / h_\text{kv}$。

对第 $i$ 个 Q 头，Attention 仍为：

$$
\text{head}_i = \text{Attn}(Q_i,\, K_{\lfloor i/g \rfloor},\, V_{\lfloor i/g \rfloor})
$$

**计算**：Q 的表达能力（多头）保留；**存储**：只需缓存 $h_\text{kv}$ 组 K/V，而非 $h_q$ 组。

### 数值例子

- $h_q = 32$，$h_\text{kv} = 8$ → $g = 4$，每 4 个 Q 头共享 1 组 K/V
- KV Cache 体积 ≈ MHA 的 $8/32 = 25\%$（K、V 各算，整体 K+V 也是 25%）

## 四、投影层形状的变化

MHA 时 $W_q, W_k, W_v$ 常均为 `[d, d]`。

GQA 时 **$W_k, W_v$ 变「窄」**：

| 权重 | 形状（列=token 约定下） |
|------|-------------------------|
| $W_q$ | `[d, d]` |
| $W_k$ | `[d_\text{kv}, d]`，其中 $d_\text{kv} = h_\text{kv} \times d_\text{head} < d$ |
| $W_v$ | 同 $W_k$ |

输出 $K, V$ 形状 `[d_\text{kv}, S]`，再 reshape 成 $h_\text{kv}$ 个头；$Q$ 仍为 `[d, S]` / $h_q$ 头。

读 config 时看：

- `num_attention_heads` → $h_q$
- `num_key_value_heads` → $h_\text{kv}$
- 若两者相等 → MHA；若 `num_key_value_heads == 1` → MQA

## 五、MHA / GQA / MQA 对照表

| | MHA | GQA | MQA |
|--|-----|-----|-----|
| **Q 头数** | $h$ | $h$ | $h$ |
| **K/V 头数** | $h$ | $h/g$ | $1$ |
| **KV Cache** | 最大 | 中等 | 最小 |
| **表达力** | 最强 | 接近 MHA | 略降，可接受 |
| **训练** | 标准 | 需匹配分组 | 需匹配共享 |
| **典型用途** | 通用 | **开源 LLM 主流** | 极致推理省显存 |

GQA 是 **MHA 与 MQA 的折中**：比 MHA 省 Cache，比 MQA 保留更多 K/V 子空间。

## 六、与 RoPE、Decode 的关系

- **RoPE**（[第 07 篇](/2026/07/05/大模型数学速成（07）：RoPE-用旋转编码位置/)）仍作用于 Q/K；GQA 只是 K 的 head 数变少
- **Decode 每步**：只算新 token 的 Q；追加新 K/V 列进 Cache——**Cache 行数/头数由 $h_\text{kv}$ 决定**
- **Prefill**：整段一次算完，Cache 填满

第 11 篇会完整走一遍 Prefill / Decode 与 Cache 显存公式。

## 七、训练 vs 推理

| 阶段 | GQA 的影响 |
|------|------------|
| **训练** | 前向反向与 MHA 同类，只是 K/V 参数更少；梯度更新 $W_k, W_v$ 的「窄矩阵」 |
| **推理** | **主要收益在 KV Cache 显存与带宽**，可服务更长上下文或更大 batch |
| **权重转换** | 已有 MHA  checkpoint 可 **uptrain / 合并 head** 转为 GQA（工程话题，超出本篇） |

## 八、小结

| 概念 | 要点 |
|------|------|
| **痛点** | Decode 时 KV Cache 随 $S$ 与 $h_\text{kv}$ 增长 |
| **GQA** | 多 Q 头共享少量 K/V 头，$g = h_q / h_\text{kv}$ |
| **MQA** | $h_\text{kv}=1$，Cache 最小 |
| **MHA** | $h_\text{kv}=h_q$，Cache 最大 |
| **config** | 看 `num_key_value_heads` |

> 大模型数学速成系列第 10 篇完。下一篇 **KV Cache**——Prefill、Decode 与显存估算，系列收官。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 09 | [多头注意力](/2026/07/07/大模型数学速成（09）：多头注意力-多个专家各看各的/) | ✅ |
| **10** | **GQA：分组查询注意力（本篇）** | ✅ |
| 11 | KV Cache：推理加速的关键 | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
