---
cover: /images/cover/ai/vit-llm-compare.png
title: 大模型数学速成（08）：ViT 层 vs LLM 层——概念对照总表
date: 2026-07-06 10:00:00
categories:
  - LLMMathPrimer
tags:
  - AI
  - 数学
  - Transformer
  - 大模型
  - 2026
---

前 7 篇我们分别讲了张量约定、矩阵乘、Q/K/V、Norm 与残差、Attention、FFN、RoPE—— pieces 齐了，但读 ViT 或 LLM 代码时仍容易混：**patch 和 token 是一回事吗？为什么 ViT 双向、LLM 因果？RMS Norm 和 LayerNorm 谁在哪？**

这一篇不引入新公式，用 **一张骨架图 + 对照大表** 把视觉 Transformer 与语言模型在同一套数学语言下对齐，并给出后续阅读路径。

<!-- more -->

> 这是「大模型数学速成」系列的第 8 篇。建议已读 [第 00–07 篇](/2026/06/28/大模型数学速成（00）：读-Transformer-前需要哪些数学？/)。下一篇 **多头注意力**。

## 一、共同的 Transformer 骨架

无论 ViT 还是 LLM，**一层 block** 的核心结构相同（Pre-LN 写法）：

```
输入 X  [d, S]     S = 序列长度（patch 数或 token 数）
    │
    ├─ Norm ──► Self-Attention ──► + 残差
    │
    ├─ Norm ──► FFN ──► + 残差
    │
    ▼
输出 X' [d, S]
```

差异在：**X 从哪来、S 代表什么、Attention 是否掩码、Norm/FFN/RoPE 用哪种变体**。

本系列约定：**行 = 特征维，列 = 序列位置**（[第 01 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/)）。

## 二、ViT vs LLM：逐项对照

| 维度 | ViT（视觉 Transformer） | LLM（因果语言模型） |
|------|-------------------------|---------------------|
| **输入单元** | 图像 patch（如 16×16 像素块） | 文本 token（BPE/SentencePiece 等） |
| **序列长度 S** | patch 个数（如 224²/16² = 196） | token 数（上下文长度，如 4K–128K） |
| **嵌入** | Patch Embedding：每个 patch 展平 → 线性投影到 $d$ | Token Embedding：查表 + 可选位置 |
| **额外 token** | 常有 **[CLS]** 列用于分类 | 无 CLS；整段序列同等对待 |
| **Self-Attention** | **双向**（每个 patch 看全部 patch） | **因果**（只能看当前及之前 token） |
| **Attention 掩码** | 通常无（或 padding 掩码） | **下三角因果掩码**（[第 05 篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/)） |
| **位置编码** | 可学习绝对位置 或 正弦；部分 ViT 无显式 RoPE | 现代 LLM 多用 **RoPE**（[第 07 篇](/2026/07/05/大模型数学速成（07）：RoPE-用旋转编码位置/)），只作用于 Q/K |
| **Norm** | 常见 **LayerNorm**（$\gamma, \beta$） | 常见 **RMS Norm**（仅 $\gamma$）（[第 04 篇](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/)） |
| **FFN 激活** | 常 **GELU**，单路上投影 | 常 **SwiGLU** 门控 FFN（[第 06 篇](/2026/07/04/大模型数学速成（06）：前馈网络FFN-GELU与SwiGLU/)） |
| **FFN 中间维** | 常 $4d$ | SwiGLU 时常 $\approx \frac{8}{3}d$ 等 |
| **输出头** | 分类头接 [CLS]；或 patch 级任务 | **LM Head**：最后一层 hidden → 词表 logits |
| **训练目标** | 分类 / 检测 / 对比学习等 | 下一 token 预测（交叉熵） |
| **推理特点** | 整图一次前向（S 固定为 patch 数） | Prefill + Decode；**KV Cache**（第 11 篇） |

**一句话**：**同一套 Q/K/V + Attention + FFN + 残差数学**；差别主要在「序列是什么、能不能看未来、Norm/FFN/RoPE 选型、输出头」。

## 三、数据流并排（形状视角）

### ViT 编码器（推理一张图）

```
图像 [H×W×3]
    ↓ Patchify + 线性
X [d, S]          S = (H/P)×(W/P)，如 d=768, S=196
    ↓ × L 层 block（双向 Attn + FFN）
Hidden [d, S]
    ↓ 取 CLS 列 或 pool
logits [num_classes]
```

### LLM 解码一步（简化）

```
已有 prompt + 新 token
    ↓ Embedding
X [d, S]
    ↓ × L 层（因果 Attn + RoPE on Q/K + SwiGLU FFN）
Hidden [d, S]
    ↓ 取最后一列
logits [vocab_size]  → 采样下一个 token
```

| 步骤 | ViT | LLM |
|------|-----|-----|
| Q/K/V 投影 | 同 [第 03 篇](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/) | 同 |
| $Q^\top K/\sqrt{d}$ + Softmax | 全连接（无因果） | 掩码后 Softmax |
| 残差 + Norm | 同 [第 04 篇](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/) | 同 |
| FFN | 同 [第 06 篇](/2026/07/04/大模型数学速成（06）：前馈网络FFN-GELU与SwiGLU/) | 同（激活常不同） |

## 四、读代码时的命名对照

不同框架张量名不同，语义大致对应：

| 概念 | ViT / 视觉常见名 | LLM 常见名 |
|------|------------------|------------|
| 层输入 | `hidden_states`, `[B,S,H]` | `hidden`, `x`, `[B,S,H]` |
| Q 投影 | `attn.q`, `q_proj` | `attn_q`, `wq` |
| Norm | `ln_1`, `layer_norm` | `attn_norm`, `rms_norm` |
| FFN 上投影 | `fc1`, `mlp.fc1` | `ffn_up`, `w3` |
| FFN 门控 | （单路时无） | `ffn_gate`, `w1` |
| FFN 下投影 | `fc2` | `ffn_down`, `w2` |
| 位置 | `pos_embed` | RoPE（无单独可学习表） |

读 ggml / ONNX / PyTorch 时，**先找 Q/K/V 与 Norm 的位置（Pre-LN）**，再对号入座上表。

## 五、多模态模型（延伸）

VLM（视觉-语言模型）常把 **ViT 编码器输出** 当作 **LLM 的 Cross-Attention 的 K/V 序列**（或投影后拼进 token 序列）：

```
图像 → ViT → 视觉 token 列 [d, S_img]
文本 → Embedding → 文本 token 列 [d, S_txt]
         ↓
    LLM 层内：文本 Q  attend  视觉 K/V（Cross-Attention）
```

本系列第 05 篇已区分 Self / Cross-Attention；多模态是 Cross 的典型场景。细节因架构而异（如是否拼接、是否共享权重），但**矩阵形状与握手规则**仍遵循 [第 01–02 篇](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/)。

## 六、推荐阅读路径（本系列内）

按目标选读，不必线性重读全文：

| 你想搞懂… | 优先复习 |
|-----------|----------|
| 权重形状、列=token | [01 张量](/2026/06/29/大模型数学速成（01）：张量、维度与「列-token」/)、[02 矩阵乘](/2026/06/30/大模型数学速成（02）：矩阵乘法-神经网络的基本变换/) |
| Attention 公式 | [03 Q/K/V](/2026/07/01/大模型数学速成（03）：Q-K-V-投影-同一输入三种角色/)、[05 Softmax](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) |
| 训练稳定性 | [04 Norm+残差](/2026/07/02/大模型数学速成（04）：LayerNorm-RMS-Norm-与残差连接/) |
| LLM FFN | [06 FFN](/2026/07/04/大模型数学速成（06）：前馈网络FFN-GELU与SwiGLU/) |
| 长文本 / 位置 | [07 RoPE](/2026/07/05/大模型数学速成（07）：RoPE-用旋转编码位置/) |
| **ViT vs LLM 总览** | **本篇** |
| 推理加速 | 第 09–11 篇（多头、GQA、KV Cache） |

## 七、与 AI 科普系列的衔接

公式细节在本系列；直觉入门可参考：

- [通俗理解 Transformer](https://shiguol.github.io/2026/06/20/通俗理解-Transformer/)
- [大语言模型是怎么工作的](https://shiguol.github.io/2026/06/20/大语言模型是怎么工作的/)

科普讲「是什么」，本系列讲「矩阵怎么乘、形状怎么变」。

## 八、小结

| 要点 | 内容 |
|------|------|
| **相同** | Norm → Attn → 残差 → Norm → FFN → 残差；Q/K/V 投影 |
| **不同** | patch vs token、双向 vs 因果、LayerNorm vs RMS、GELU vs SwiGLU、RoPE、输出头 |
| **形状** | 层内始终是 `[d, S]` 列=位置 |
| **下一步** | 多头、GQA、KV Cache（推理专题） |

> 大模型数学速成系列第 8 篇完。下一篇 **多头注意力**——同一层里多个「专家」各看各的。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 07 | [RoPE](/2026/07/05/大模型数学速成（07）：RoPE-用旋转编码位置/) | ✅ |
| **08** | **ViT 层 vs LLM 层对照总表（本篇）** | ✅ |
| 09 | 多头注意力 | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
