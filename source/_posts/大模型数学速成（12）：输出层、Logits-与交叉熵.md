---
cover: /images/cover/ai/lm-head-cross-entropy.png
title: 大模型数学速成（12）：输出层、Logits 与交叉熵
date: 2026-07-10 10:00:00
categories:
  - LLMMathPrimer
tags:
  - AI
  - 数学
  - Transformer
  - 大模型
  - 2026
  - 训练
---

[第 11 篇](/2026/07/09/大模型数学速成（11）：KV-Cache-推理加速的关键/) 把 **Prefill / Decode 与 KV Cache** 讲完，第一季在「一层 Transformer 怎么前向」处收官。但生成下一个 token 之前，模型还要做最后一步：**把最后一个（或每一个）位置的 hidden 变成词表上的分数，再变成概率**。

训练时，我们用 **交叉熵（Cross-Entropy）** 衡量「猜对下一个 token」有多准——这正是 next-token prediction 的数学核心。本篇是续篇首篇：从 **lm_head → logits → Softmax → 损失** 一次算明白。

<!-- more -->

> 这是「大模型数学速成」**续篇第 12 篇**（第一季 00–11 已完结）。建议先熟悉 [第 05 篇 Softmax](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) 与 [Token 科普](/2026/06/20/Token-AI眼中的文字/)。下一篇讲 **因果掩码与解码循环**。

## 一、最后一层 hidden 还不是「词」

经过 $L$ 层 Transformer 后，每个位置有一个特征向量（本系列约定：**列 = token**，形状大致 `[d, S]`）。  
对「预测下一个 token」来说，我们通常取**当前要预测的那个位置**的 hidden 向量 $\mathbf{h} \in \mathbb{R}^{d}$（例如 Decode 时最新位置）。

$\mathbf{h}$ 仍在「语义空间」里，**还不是词表里的某一个 id**。需要一层线性变换，把它投影到 **词表大小 $V$** 的分数上：

$$
\mathbf{z} = W_{\mathrm{lm}} \mathbf{h} + \mathbf{b}
$$

| 符号 | 含义 | 典型量级（公开常见配置，仅示意） |
|------|------|----------------------------------|
| $\mathbf{h}$ | 隐藏状态 | $d$ 如 4096 |
| $W_{\mathrm{lm}}$ | 输出投影，常称 **lm_head** | 形状约 $[V, d]$ |
| $\mathbf{z}$ | **logits**（未归一化分数） | 长度 $V$（如数万） |
| $\mathbf{b}$ | 偏置（很多实现省略） | 长度 $V$ 或无 |

有的模型做 **weight tying**：把输入 embedding 矩阵与 $W_{\mathrm{lm}}$ 绑成同一套参数，省参数、也常更稳——概念上仍是「hidden → 词表分数」。

## 二、Logits 不是概率

$\mathbf{z}$ 的分量可正可负、可大可小，**不必和为 1**。把它变成「下一个 token 是词 $i$ 的概率」仍用 [第 05 篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) 的 Softmax：

$$
p_i = \frac{e^{z_i}}{\sum_{j=1}^{V} e^{z_j}}, \quad i = 1,\ldots,V
$$

| 对象 | 是什么 | 常见用途 |
|------|--------|----------|
| **logits $\mathbf{z}$** | 未归一化分数 | 采样、温度缩放、损失计算的入口 |
| **概率 $\mathbf{p}$** | Softmax 后，和为 1 | 解释「模型有多确信」 |
| **预测 id** | $\arg\max_i p_i$ 或采样 | 真正吐出的下一个 token |

推理时可以**不显式物化**完整 $\mathbf{p}$（有的实现用数值稳定的 log-softmax 直接采样）；数学上等价于在 $\mathbf{z}$ 上做 Softmax。

## 三、交叉熵：猜错要挨打的分数

训练样本在某个位置上有**正确答案** token id，记为 $y^\star$（教师强制：看前文，预测下一个真实词）。

模型给出概率 $p_{y^\star}$。**交叉熵损失**（单位置、单样本）就是负对数似然：

$$
\mathcal{L} = -\log p_{y^\star}
$$

| $p_{y^\star}$ | $\mathcal{L} = -\log p$ | 直觉 |
|---------------|-------------------------|------|
| 接近 1 | 接近 0 | 猜得很准，几乎不罚 |
| 0.5 | $\approx 0.69$ | 半信半疑 |
| 0.1 | $\approx 2.30$ | 罚得重 |
| 接近 0 | $\to +\infty$ | 几乎没分给正确答案，损失爆炸 |

对 batch、序列多个位置，通常对有效位置（非 padding）**取平均**：

$$
\mathcal{L}_{\mathrm{batch}} = \frac{1}{N}\sum_{n=1}^{N} -\log p^{(n)}_{y^{\star(n)}}
$$

**一句话**：预训练 / SFT 的主目标，大多是「在因果掩码下，对每个位置做 next-token 交叉熵」——数据分布不同，**损失形式常是同一套**。

### 和 Softmax 写在一起

若正确答案是 one-hot 向量 $\mathbf{y}$（仅 $y^\star$ 处为 1），则：

$$
\mathcal{L} = -\sum_{i=1}^{V} y_i \log p_i = -\log p_{y^\star}
$$

实现里几乎从不用显式 one-hot，而是用「目标 id + log-softmax」的融合算子（如 `cross_entropy`），数值更稳、更快。

## 四、手算小例子（词表只有 3 个词）

假设词表：`{猫, 狗, 鱼}`，某位置 logits：

$$
\mathbf{z} = [2.0,\ 1.0,\ 0.1]
$$

### Step 1：Softmax

$$
e^{2.0}\approx 7.389,\quad e^{1.0}\approx 2.718,\quad e^{0.1}\approx 1.105
$$

$$
\sum e^{z_j} \approx 11.212
$$

$$
\mathbf{p} \approx [0.659,\ 0.242,\ 0.099]
$$

### Step 2：若正确答案是「猫」（下标 0）

$$
\mathcal{L} = -\log 0.659 \approx 0.417
$$

### Step 3：若正确答案是「鱼」（下标 2）

$$
\mathcal{L} = -\log 0.099 \approx 2.313
$$

同一组 logits，**标签不同，损失差很多**——训练就是通过反向传播，把 $W_{\mathrm{lm}}$ 与前面所有层往「提高 $p_{y^\star}$」的方向推。

```
logits z:   猫 2.0    狗 1.0    鱼 0.1
              │         │         │
           Softmax   Softmax   Softmax
              ▼         ▼         ▼
prob p:     0.66      0.24      0.10
              │
        若 y*=猫 → L ≈ 0.42（较轻）
        若 y*=鱼 → L ≈ 2.31（较重）
```

## 五、训练在优化什么、推理在用什么

| 阶段 | 用 logits 做什么 |
|------|------------------|
| **预训练** | 海量文本上 next-token CE；学语言统计与世界知识的「接龙」能力 |
| **SFT** | 仍是 CE，数据换成「指令 → 理想回复」等格式 |
| **对齐（RLHF/DPO 等）** | 目标函数会变（续篇第 19 篇预告）；不再是单纯 CE |
| **推理** | 不算 CE；对 $\mathbf{z}$ 做贪心 / 温度 / top-k / top-p **采样**（续篇第 14 篇） |

第一季的 Attention、FFN、RoPE 等，都是在**制造更好的 $\mathbf{h}$**；本篇的 lm_head + CE，是在**规定 $\mathbf{h}$ 最终要服务的目标**。

## 六、数值稳定小贴士（知道即可）

直接算 $e^{z_i}$ 时，若某个 $z_i$ 很大，可能溢出。常用技巧：

$$
p_i = \frac{e^{z_i - m}}{\sum_j e^{z_j - m}},\quad m = \max_j z_j
$$

先减行内最大值，再 Softmax——与 [第 05 篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) 的「缩放稳定 Softmax」同一类思想。框架里的 `log_softmax` + NLL 会帮你做稳妥实现。

## 七、小结

| 概念 | 要点 |
|------|------|
| **lm_head** | $W_{\mathrm{lm}}\mathbf{h}$，hidden → 词表维 logits |
| **logits** | 未归一化分数，不是概率 |
| **Softmax** | $\mathbf{z}\to\mathbf{p}$，和为 1 |
| **交叉熵** | $\mathcal{L}=-\log p_{y^\star}$，next-token 主损失 |
| **训练 vs 推理** | 训练回传 CE；推理对 logits 采样 |

> 大模型数学速成续篇第 12 篇完。下一篇 **因果掩码与解码循环**——训练如何并行算整句 CE，以及 Prefill/Decode 如何「不许偷看未来」。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 11 | [KV Cache](/2026/07/09/大模型数学速成（11）：KV-Cache-推理加速的关键/) | ✅ 第一季收官 |
| **12** | **输出层、Logits 与交叉熵（本篇）** | ✅ 续篇首篇 |
| 13 | 因果掩码与解码循环 | 下一篇 |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE_V2.md`。
