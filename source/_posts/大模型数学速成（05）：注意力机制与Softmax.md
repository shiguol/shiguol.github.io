---
cover: /images/cover/ai/attention-softmax.png
title: 大模型数学速成（05）：注意力机制与 Softmax
date: 2026-07-03 10:00:00
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

[上一篇](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/)我们有了 Norm 与残差；[第 03 篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/)我们算出了 Q、K、V。现在进入 Transformer 的核心：**每个 token 用 Q 去「查询」全序列的 K，按匹配度加权混合 V**。

这一篇把 **注意力分数、Softmax、输出混合** 的公式与手算例子讲清楚，并区分 Self-Attention 与 Cross-Attention。

<!-- more -->

> 这是「大模型数学速成」系列的第 5 篇。建议先读 [第 04 篇：LayerNorm 与残差](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/)。下一篇讲 **前馈网络 FFN**。

## 一、图书馆检索三步

把 [第 03 篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/) 的图书馆类比补全：

| 步骤 | 数学 | 生活类比 |
|------|------|----------|
| **1. 匹配** | $Q$ 与每个 $K$ 算相似度 → **scores** | 你的检索便签与每本书脊标签比对 |
| **2. 归一化** | Softmax → **权重**（和为 1） | 把分数变成「借哪几本、各占多少比例」 |
| **3. 混合** | 按权重对 $V$ 加权求和 → **输出** | 把选中书的正文按比例拼成一份摘要 |

三步走完，每个 token 的输出不再只是「自己长什么样」，而是**融入了它选择关注的其他 token 的信息**。

## 二、符号与形状（列 = token）

沿用本系列约定（[第 01 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/)）：

- $Q, K, V$ 形状均为 `[d, S]`（$d$ = 特征维如 768，$S$ = token 数）
- **第 $i$ 列** $q_i, k_i, v_i$ 是 token $i$ 的 query / key / value 向量

## 三、Step 1：注意力分数 scores

token $i$ 的 query 与 token $j$ 的 key 的**点积**衡量「$i$ 想关注 $j$ 的程度」：

$$
\text{score}_{i,j} = q_i \cdot k_j = \sum_{t=1}^{d} Q_{t,i} \cdot K_{t,j}
$$

所有 $(i,j)$ 拼成矩阵 $\mathbf{S} \in \mathbb{R}^{S \times S}$：

$$
\mathbf{S} = Q^\top K
$$

```
        K 的列（各 token 的 key）
        j=0    j=1    j=2
Q 的行  ┌─────────────────────┐
(i=0)   │ score₀,₀ score₀,₁ … │  ← token 0 对每个 key 的匹配分
(i=1)   │ score₁,₀ score₁,₁ … │
        └─────────────────────┘
```

**点积直觉**：向量方向越接近、长度越大 → 点积越高 → 「更匹配」。训练让 $W_q, W_k$ 学会抽出便于匹配的子空间。

### 为什么要除以 $\sqrt{d}$？

$d$ 很大时点积方差随维度增长，Softmax 容易**极端化**（一个接近 1、其余接近 0），梯度变小。Scaled Dot-Product Attention：

$$
\mathbf{S} = \frac{Q^\top K}{\sqrt{d}}
$$

$\sqrt{d}$ 把分数拉回合理尺度——这是原始 Transformer 论文里的标准做法。

## 四、Step 2：Softmax 变成概率权重

对 **scores 的每一行**（固定 query $i$，对所有 key $j$）做 Softmax：

$$
\alpha_{i,j} = \frac{\exp(\text{score}_{i,j})}{\sum_{k=0}^{S-1} \exp(\text{score}_{i,k})}
$$

性质：

- $\alpha_{i,j} \ge 0$
- $\sum_j \alpha_{i,j} = 1$（对每个 $i$）

$\alpha_{i,j}$ = 「token $i$ 应该从 token $j$ 借多少信息」。

### 手算 Softmax（3 个 key）

某 token 的原始分数（已缩放）$s = [2.0,\ 1.0,\ 0.0]$：

```
exp:  [7.39,  2.72,  1.00]
sum:  11.11
α:    [0.665, 0.245, 0.090]   ← 和 = 1
```

最高分 2.0 拿到约 66% 权重，其余分摊。

### Temperature（温度）

推理时常见 **temperature** $\tau$：

$$
\alpha_{i,j} = \text{Softmax}\left(\frac{\mathbf{s}_i}{\tau}\right)
$$

| $\tau$ | 效果 |
|--------|------|
| $\tau < 1$ | 分布更「尖」——更聚焦少数 token |
| $\tau = 1$ | 标准 Softmax |
| $\tau > 1$ | 分布更平——更均匀混合 |

Chat 模型调「创造性」时，部分实现会动 sampling 的 temperature；注意力里概念相同：**缩放 logits 再 Softmax**。

## 五、Step 3：加权混合 V 得到输出

token $i$ 的输出向量：

$$
o_i = \sum_{j=0}^{S-1} \alpha_{i,j} \cdot v_j
$$

整段序列写成矩阵（列 = token）：

$$
O = V \cdot P^\top, \quad P_{i,j} = \alpha_{i,j}
$$

**输出形状** `[d, S]`——与输入 Q/K/V 相同，可接残差（[第 04 篇](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/)）。

### 接上第 03 篇的猫头例子

[第 03 篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/) 示意分数与权重：

```
scores(猫头 Q · 各 K):  [0.1, 0.9, 0.8, 0.2]  →  Softmax  →  [5%, 40%, 45%, 10%]
```

$$
o_{\text{猫头}} = 0.05\, v_{\text{蓝天}} + 0.40\, v_{\text{猫头}} + 0.45\, v_{\text{猫身}} + 0.10\, v_{\text{草地}}
$$

猫头 token 的新表示里**混入了猫身轮廓**——「头」看见了「身体」，语义更完整。

## 六、完整公式一览

$$
\text{Attention}(Q, K, V) = V \cdot \text{Softmax}\!\left(\frac{Q^\top K}{\sqrt{d}}\right)^\top
$$

（Softmax 按 $Q^\top K$ 的**行**计算。）

数据流：

```
X [d,S] ──Norm──► 投影 ──► Q,K,V [d,S]
                              │
                    S = QᵀK / √d   [S×S]
                              │
                         Softmax(行)
                              │
                    O = V · Pᵀ     [d,S]
                              │
                         + 残差 x
```

## 七、Self-Attention vs Cross-Attention

| | Self-Attention | Cross-Attention |
|--|----------------|-----------------|
| **Q 来自** | 当前序列 | 当前序列（如 decoder） |
| **K、V 来自** | **同一序列** | **另一序列**（如 encoder 输出） |
| **在做什么** | token 互相看 | 用 A 序列的 Q 查 B 序列的 K/V |
| **典型场景** | LLM 每一层、ViT patch 互看 | 机器翻译 decoder 看 encoder；多模态「文字问图像」 |

Self-Attention 里 $Q, K, V$ 同源——「自己人互相检索」。Cross-Attention 里 Q 与 K/V **不同源**，实现跨模态或 encoder-decoder 对齐。

本系列后续默认 **Self-Attention**，除非特别说明。

## 八、因果掩码（Causal Mask）预告

LLM **解码**时，token $i$ 不能看见 $j > i$ 的未来 token。实现上在 Softmax 前把非法位置的 score 设为 $-\infty$（或很大的负数），Softmax 后权重为 0。

这是推理与 KV Cache 的基础（第 11 篇详讲）；训练 GPT 类模型时同样用**下三角掩码**。

## 九、与训练 / 推理的关系

| 阶段 | 注意力在做什么 |
|------|----------------|
| **训练** | 全序列 Self-Attn + 掩码；$W_q,W_k,W_v$ 与输出投影 $W_o$ 一起反向传播 |
| **Prefill** | 整段 prompt 一次算 $S \times S$ 的注意力矩阵 |
| **Decode** | 每步只算新 token 的 Q 与**全部** K 做点积；历史 K/V 可缓存 |

计算复杂度（单层、单头）：$O(S^2 \cdot d)$——序列变长，注意力是主要瓶颈之一；GQA、FlashAttention 等是后话（第 10 篇及以后）。

## 十、小结

| 概念 | 要点 |
|------|------|
| **scores** | $Q^\top K$，形状 `[S,S]`，$i$ 行 = query $i$ 对所有 key |
| **缩放** | 除以 $\sqrt{d}$，稳定 Softmax |
| **Softmax** | 按行归一化，权重和为 1 |
| **输出** | $O = V P^\top$，按权重混合 value |
| **Self** | Q/K/V 同源，token 互看 |
| **Cross** | Q 一路，K/V 另一路 |

> 大模型数学速成系列第 5 篇完。下一篇 **前馈网络 FFN**——注意力负责「看谁」，FFN 负责「怎么想」。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 04 | [LayerNorm 与残差](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/) | ✅ |
| **05** | **注意力机制与 Softmax（本篇）** | ✅ |
| 06 | 前馈网络 FFN：GELU 与 SwiGLU | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
