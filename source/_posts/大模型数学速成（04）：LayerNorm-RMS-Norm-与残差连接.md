---
cover: /images/cover/ai/norm-residual.webp
title: 大模型数学速成（04）：LayerNorm、RMS Norm 与残差连接
date: 2026-07-02 10:00:00
categories:
  - LLMMathPrimer
tags:
- AI
- 数学
- Transformer
- 大模型
- 2026
- LayerNorm
- 残差连接
- 归一化
mathjax: true
---

[上一篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/)我们算出 Q、K、V——但在乘 $W_q$ 之前，输入通常先过 **LayerNorm 或 RMS Norm**。算完注意力或 FFN 之后，还要加一条 **残差连接** 把原输入「抄送」回来。

这一篇搞懂：**为什么要归一化、两种 Norm 差在哪、Pre-LN 与 Post-LN 怎么排、残差为什么能训深网络**。

<!-- more -->

> 这是「大模型数学速成」系列的第 4 篇。建议先读 [第 03 篇：Q/K/V 投影](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/)。下一篇讲 **注意力机制与 Softmax**。

## 一、为什么需要归一化？

深度网络堆叠几十层后，中间激活的**数值尺度**容易漂移：某些维爆炸、某些维趋近 0，梯度不稳定，训练变慢甚至发散。

**归一化（Normalization）** 对每个 token 的特征向量做「拉回标准尺度」——让均值为 0、方差为 1（或类似效果），再交给下一层矩阵乘法。

生活类比：**音响均衡器**——不管输入音量忽大忽小，先归一化到合适响度，再进功放。

在本系列约定下（[第 01 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/)）：

- 输入形状 `[n_embd, n_tokens]`，**每一列**是一个 token 的 $n_embd$ 维向量
- Norm **按列**操作：对每个 token 独立归一化，**不改变 token 个数**

## 二、LayerNorm 四步与 $\gamma$ / $\beta$

对某一列（单个 token）的特征向量 $\mathbf{x} \in \mathbb{R}^d$（$d = n\_embd$）：

**Step 1 — 求均值**

$$
\mu = \frac{1}{d} \sum_{i=1}^{d} x_i
$$

**Step 2 — 求方差**

$$
\sigma^2 = \frac{1}{d} \sum_{i=1}^{d} (x_i - \mu)^2
$$

**Step 3 — 标准化**（加 $\epsilon$ 防除零）

$$
\hat{x}_i = \frac{x_i - \mu}{\sqrt{\sigma^2 + \epsilon}}
$$

**Step 4 — 仿射变换**（可学习的缩放与平移）

$$
y_i = \gamma_i \cdot \hat{x}_i + \beta_i
$$

| 符号 | 含义 | 是否可训练 |
|------|------|-----------|
| $\mu, \sigma^2$ | 当前 token 特征的均值、方差 | 否（统计量） |
| $\gamma$ | 逐维缩放（scale） | **是** |
| $\beta$ | 逐维平移（shift） | **是** |

$\gamma$、$\beta$ 是长度为 $d$ 的向量，**每层、每个 Norm 各有一套**。Step 3 把分布拉平，Step 4 让网络自己决定「拉平之后还要不要偏移、放大某几维」。

**输出形状**：与输入相同 `[d, 1]`（单列）或整批 `[d, n_tokens]`。

## 三、RMS Norm：少算均值，LLM 更常见

**RMS Norm**（Root Mean Square Normalization）省略减均值，只按**均方根**缩放：

$$
\text{RMS}(\mathbf{x}) = \sqrt{\frac{1}{d} \sum_{i=1}^{d} x_i^2 + \epsilon}
$$

$$
\hat{x}_i = \frac{x_i}{\text{RMS}(\mathbf{x})}, \qquad
y_i = \gamma_i \cdot \hat{x}_i
$$

注意：RMS Norm **通常没有 $\beta$**，只有可学习的 $\gamma$。

| | LayerNorm | RMS Norm |
|--|-----------|----------|
| 减均值 | ✅ | ❌ |
| 除 RMS / 标准差 | ✅ | ✅（仅 RMS） |
| 可学习 $\gamma$ | ✅ | ✅ |
| 可学习 $\beta$ | ✅ | ❌（常见实现） |
| 计算量 | 稍多 | 稍少 |
| 典型模型 | 原始 Transformer、ViT | LLaMA、Qwen 等 LLM |

直觉：LLM 特征维很大（如 4096），减均值带来的收益相对有限，**RMS Norm 更省算力**，效果相当。

## 四、Pre-LN vs Post-LN：Norm 放哪一层？

一个 Transformer 子层（以注意力为例）有两种常见排布：

**Post-LN（原始论文）**：

```
x → Attention → (+ x 残差) → LayerNorm → 输出
```

**Pre-LN（现代 LLM 主流）**：

```
x → LayerNorm → Attention → (+ x 残差) → 输出
```

| 布局 | 优点 | 缺点 |
|------|------|------|
| **Post-LN** | 与早期 BERT/GPT-2 一致 | 深层训练需小心 warmup |
| **Pre-LN** | 梯度更稳、易训深 | 实现略不同 |

读代码时看 **Norm 在子层之前还是之后** 即可。本系列后续公式默认 **Pre-LN** 语境（与多数开源 LLM 一致）。

## 五、残差连接：$y = x + f(x)$

**残差（Residual）** 把子层的输入 $x$ 与子层输出 $f(x)$ **逐元素相加**：

$$
\mathbf{y} = \mathbf{x} + f(\mathbf{x})
$$

形状要求：$f(\mathbf{x})$ 与 $\mathbf{x}$ **完全相同**——特征维、token 数都不变。Attention 和 FFN 的输出维都设计为与输入一致，就是为了能残差相加。

### 两个类比

**高架桥旁路**：主路（$x$）不拆，新桥（$f(x)$）在旁边叠加流量——信息可以「跳过」复杂变换直达下游。

**调音台干声 + 效果**：原信号（$x$）与效果器输出（$f(x)$）混音（相加），避免效果器把原信号完全盖住。

### 为什么有用？

1. **恒等捷径**：若 $f$ 学成接近 0，则 $y \approx x$，层可以「什么都不做」——训极深网络时，浅层行为不会被破坏。
2. **梯度 +1**：反向传播时，$\partial y / \partial x = 1 + \partial f / \partial x$，至少有一条梯度路径不被连乘衰减（缓解梯度消失）。

## 六、拼成完整子层：Pre-LN + 残差

以 **Pre-LN 自注意力** 为例（省略多头，形状 `[768, S]`）：

```
输入 x
  │
  ├──────────────────────────────┐  （残差支路：原样保留）
  │                              │
  ▼                              │
LayerNorm（或 RMS Norm）          │
  │                              │
  ▼                              │
Attention(Q,K,V)  →  f(x)        │
  │                              │
  └────────── (+) ◄──────────────┘
              │
              ▼
           输出 y = x + f(x)
```

FFN 子层同理：`y = x + \text{FFN}(\text{Norm}(x))$。

**维度检查**（与 [第 01 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/) 对照）：

| 运算 | 输入形状 | 输出形状 | token 数 |
|------|----------|----------|----------|
| LayerNorm / RMS Norm | `[768, S]` | `[768, S]` | 不变 |
| 残差 $x + f(x)$ | `[768, S]` | `[768, S]` | 不变 |
| Q/K/V 矩阵乘 | `[768, S]` | `[768, S]` | 不变 |

Norm 与残差**只动数值尺度与相加**，不改变张量形状——这是读 ggml / PyTorch 代码时的重要锚点。

## 七、极简手算：LayerNorm 一列

$d=4$，某 token 列 $\mathbf{x} = [2, 4, 4, 6]^\top$：

1. $\mu = (2+4+4+6)/4 = 4$
2. $\sigma^2 = ((2-4)^2 + (4-4)^2 + (4-4)^2 + (6-4)^2)/4 = 2$
3. $\hat{x} = (x - 4) / \sqrt{2}$ → 约 $[-1.41, 0, 0, 1.41]^\top$
4. 若 $\gamma = [1,1,1,1]$、$\beta = [0,0,0,0]$，则 $y = \hat{x}$

RMS Norm 同一列：$\text{RMS} = \sqrt{(4+16+16+36)/4} = \sqrt{18} \approx 4.24$，$\hat{x}_i = x_i / 4.24$，再乘 $\gamma$。

手算不必精确到小数点后很多位——重点是理解 **按列独立、输出维不变**。

## 八、与训练 / 推理的关系

| 阶段 | Norm + 残差的作用 |
|------|-------------------|
| **训练** | 稳定激活分布；残差提供梯度高速公路；$\gamma$/$\beta$ 随反向传播更新 |
| **推理** | 每层前向都做同样的 Norm 与相加；$\gamma$/$\beta$ 固定为 checkpoint 中的值 |
| **权重文件** | 每层有 `attn_norm.weight`（RMS 的 $\gamma$）或 `ln_1.weight` / `ln_1.bias`（LayerNorm 的 $\gamma$/$\beta$）等命名 |

Norm 在 Q/K/V 投影**之前**（Pre-LN），所以 [第 03 篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/) 里的 $X$ 通常是 **Norm 之后的特征**。

## 九、小结

| 概念 | 要点 |
|------|------|
| **LayerNorm** | 减均值 → 除标准差 → $\gamma \hat{x} + \beta$ |
| **RMS Norm** | 只除 RMS → $\gamma \hat{x}$；LLM 常用 |
| **Pre-LN** | 先 Norm 再子层，再残差；训深模型更稳 |
| **残差** | $y = x + f(x)$，形状不变，梯度多 +1 通路 |
| **按列** | 每个 token 独立 Norm，列数 = token 数不变 |

> 大模型数学速成系列第 4 篇完。下一篇进入 **注意力机制与 Softmax**——Q·Kᵀ 之后到底在算什么。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 03 | [Q/K/V 投影](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/) | ✅ |
| **04** | **LayerNorm、RMS Norm 与残差连接（本篇）** | ✅ |
| 05 | 注意力机制与 Softmax | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
