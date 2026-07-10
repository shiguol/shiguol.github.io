---
cover: /images/cover/ai/ffn-gelu-swiglu.png
title: 大模型数学速成（06）：前馈网络 FFN——GELU 与 SwiGLU
date: 2026-07-04 10:00:00
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

[上一篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/)里，每个 token 通过注意力「看过」其他 token。但注意力只做**加权混合**——线性组合 V，表达能力有限。Transformer 块的另一半是 **FFN（Feed-Forward Network，前馈网络）**：对每个 token **独立**做「升维 → 非线性 → 降维」，注入更强的逐 token 变换能力。

这一篇搞懂 FFN 在算什么、GELU / SwiGLU 是什么、以及 ViT 与 LLM 的常见差异。

<!-- more -->

> 这是「大模型数学速成」系列的第 6 篇。建议先读 [第 05 篇：注意力与 Softmax](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/)。下一篇讲 **RoPE 位置编码**。

## 一、注意力 vs FFN：分工不同

| | Self-Attention | FFN |
|--|----------------|-----|
| **跨 token** | ✅ token 之间交换信息 | ❌ 每个 token **独立**处理 |
| **主要操作** | 加权求和（线性） | 矩阵乘 + **非线性激活** |
| **类比** | 开会对齐信息 | 会后各自消化、深度加工 |
| **形状** | `[d, S]` → `[d, S]` | `[d, S]` → `[d, S]` |

完整 Transformer 子层（Pre-LN）典型顺序：

```
x → Norm → Attention → +残差 → Norm → FFN → +残差 → 输出
```

Attention 负责「看谁」；FFN 负责「怎么想」——在混合完上下文之后，对每个位置做**同样的 MLP 变换**（权重共享，但每个 token 用自己的列向量）。

## 二、升维 → 激活 → 降维

经典 FFN（以 hidden 维 $d$、中间维 $d_\text{ff}$ 为例，常 $d_\text{ff} = 4d$）：

$$
\text{FFN}(x) = W_2 \cdot \sigma(W_1 \cdot x + b_1) + b_2
$$

其中 $x$ 是某一 token 的 $d$ 维列向量，$\sigma$ 是非线性激活。

**三步直觉**：

```
x [d]  ──W1──►  h [d_ff]   升维（如 768 → 3072）
              │
           σ(·)              非线性（GELU / ReLU / SwiGLU）
              │
           ──W2──►  y [d]   降维（3072 → 768）
```

| 步骤 | 形状变化 | 作用 |
|------|----------|------|
| $W_1 x$ | `[d]` → `[d_ff]` | 投影到高维空间，增加表达容量 |
| $\sigma$ | 逐元素 | 引入非线性，否则多层线性仍等价一层 |
| $W_2 h$ | `[d_ff]` → `[d]` | 压回原维，供残差相加 |

整批 token：$X$ 为 `[d, S]`，$W_1$ 为 `[d_ff, d]`，则 $H = \sigma(W_1 X + b_1)$ 为 `[d_ff, S]`——**列数 S 始终不变**（与 [第 01 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/) 一致）。

## 三、GELU：平滑版 ReLU

**ReLU**：$\text{ReLU}(x) = \max(0, x)$——简单，但在 0 处不可导。

**GELU**（Gaussian Error Linear Unit）：

$$
\text{GELU}(x) = x \cdot \Phi(x)
$$

其中 $\Phi(x)$ 是标准正态分布的 CDF。直觉：**按概率「软门控」**——负值不是硬截断为 0，而是平滑缩小。

近似公式（实现常用）：

$$
\text{GELU}(x) \approx 0.5 x \left(1 + \tanh\left[\sqrt{2/\pi}\,(x + 0.044715 x^3)\right]\right)
$$

| 激活 | 特点 | 常见模型 |
|------|------|----------|
| ReLU | 简单、快 | 早期 Transformer、部分 ViT |
| **GELU** | 平滑、表现好 | BERT、GPT-2、部分 ViT |
| **SwiGLU** | 门控 + 更大容量 | LLaMA、Qwen 等现代 LLM |

GELU 在负半轴允许小梯度通过，训练往往比 ReLU 更稳。

## 四、SwiGLU：门控 FFN（现代 LLM 主流）

SwiGLU 把 FFN 拆成**两路上投影 + 门控**：

$$
\text{SwiGLU}(x) = \big(\text{Swish}(x W_g) \odot (x W_u)\big) W_d
$$

- $W_g$、$W_u$：两路「上投影」矩阵（gate / up）
- $\text{Swish}(t) = t \cdot \sigma(t)$（与 SiLU 相同）
- $\odot$：逐元素相乘（门控）
- $W_d$：下投影

```
        x [d]
       /   \
   × W_g   × W_u
      │       │
   Swish(·)   │
      └───⊙───┘   门控：一路当「开关」，一路当「内容」
          │
        × W_d
          │
        y [d]
```

**为什么 LLM 爱用 SwiGLU？**

- 门控让网络**选择性通过**信息，表达力更强
- 参数量略增（两路上投影），但同预算下效果通常优于单路 GELU-FFN
- 典型配置：中间维不再严格 $4d$，而按 $ \frac{8}{3}d $ 等比例调整以控制总参数

读 checkpoint 时常见张量名：`ffn_gate`、`ffn_up`、`ffn_down`（或 `w1/w2/w3` 等命名，依框架而定）。

## 五、ViT vs LLM 的 FFN 对照

| | ViT（视觉） | LLM（语言） |
|--|------------|-------------|
| **输入** | patch 特征列 | token 嵌入列 |
| **Attention** | patch 互看 | token 互看（+ 因果掩码） |
| **FFN 激活** | 常 GELU | 常 **SwiGLU** 或 GELU |
| **中间维** | 常 $4 \times d$ | SwiGLU 时可能 $\approx \frac{8}{3}d$ |
| **是否共享** | 每层独立 FFN | 每层独立 FFN |

骨架相同：**Attn + FFN + Norm + 残差**；差异主要在激活函数与张量命名。

## 六、与残差的拼接

FFN 子层（Pre-LN）：

$$
y = x + \text{FFN}(\text{Norm}(x))
$$

- 输入输出都是 `[d, S]`
- FFN 权重 $W_1, W_2$（或 gate/up/down）**每层独立**
- 与 Attention 子层**串行**：先 Attn+残差，再 FFN+残差

一层 Transformer block 结束后的特征，已经过「全局混合（Attn）」和「逐 token 深化（FFN）」两轮加工。

## 七、极简数值直觉

设 $d=2$，某 token $x = [1, 0]^\top$，$W_1$ 升到 4 维，ReLU 后 2 维为正，$W_2$ 压回 2 维——**非线性**让输出不再是 $x$ 的线性倍数，从而与 Attention 的线性混合形成互补。

手算不必展开 3072 维；记住 **FFN = 同一套 MLP 应用于每个 token 列** 即可。

## 八、与训练 / 推理的关系

| 阶段 | FFN |
|------|-----|
| **训练** | gate/up/down（或 fc1/fc2）随反向传播更新；激活在 forward 时逐元素计算 |
| **推理** | 权重固定；Prefill 与 Decode 都对每个 token 列做 FFN |
| **算力** | FFN 占单层 FLOPs 的大头（中间维大）；与 Attention 的 $O(S^2 d)$ 并列优化目标 |

MoE（Mixture of Experts）可以看作「多个 FFN 专家 + 路由」——超出本系列范围，但核心仍是升维-激活-降维。

## 九、小结

| 概念 | 要点 |
|------|------|
| **FFN 分工** | 逐 token MLP，不跨 token |
| **结构** | 升维 → $\sigma$ → 降维，形状 `[d,S]` 不变 |
| **GELU** | 平滑激活，BERT/GPT-2 常见 |
| **SwiGLU** | 双路上投影 + 门控，现代 LLM 常见 |
| **位置** | Attention 残差之后，再 FFN 残差 |

> 大模型数学速成系列第 6 篇完。下一篇 **RoPE**——用旋转给 Q/K 注入位置信息。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 05 | [注意力与 Softmax](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) | ✅ |
| **06** | **前馈网络 FFN（本篇）** | ✅ |
| 07 | RoPE：用旋转编码位置 | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
