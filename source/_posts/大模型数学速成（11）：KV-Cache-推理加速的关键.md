---
cover: /images/cover/ai/kv-cache.png
title: 大模型数学速成（11）：KV Cache——推理加速的关键
date: 2026-07-09 10:00:00
categories:
  - LLMMathPrimer
tags:
  - AI
  - 数学
  - Transformer
  - 大模型
  - 2026
  - 推理
mathjax: true
---

没有 **KV Cache**，大模型逐 token 生成会反复重算整段历史的 K、V——复杂度爆炸、延迟不可接受。[第 10 篇](/2026/07/08/大模型数学速成（10）：GQA-分组查询注意力/) 讲了用 GQA 压缩 Cache 体积；本篇收官：**Prefill / Decode 两阶段**、Decode 单步在算什么、显存怎么估，以及多模态里 Cache 怎么共享。

<!-- more -->

> 这是「大模型数学速成」系列的**第 11 篇（收官）**。建议先读 [第 10 篇：GQA](/2026/07/08/大模型数学速成（10）：GQA-分组查询注意力/)。

## 一、O(N²) 重复计算问题

生成第 $t$ 个 token 时，Attention 需要当前 Q 与**位置 $1 \ldots t$ 的全部 K** 做点积（[第 05 篇](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/)）。

若**不缓存** K/V，每步 Decode 都要对整段输入重新做 Q/K/V 投影和 Attention：

| 步数 | 每步参与 token 数 |  naive 总计算量量级 |
|------|-------------------|---------------------|
| 生成 $S$ 个 token | $1, 2, \ldots, S$ | $O(S^2)$ 重复投影 + Attention |

长对话下，**算力浪费在「重算旧 token 的 K/V」** 上。KV Cache 的核心思想：**算过的 K/V 存起来，Decode 只算新 token**。

## 二、Prefill vs Decode

| 阶段 | 何时 | 算什么 | Cache |
|------|------|--------|-------|
| **Prefill** | 用户 prompt 一次性送入 | 整段 $S_0$ 个 token 的 Q/K/V、Attention、FFN | **填满** 初始 Cache（长度 $S_0$） |
| **Decode** | 自回归，每次生成 1 个新 token | 仅**新 token** 的 Q/K/V；Attention 用 Cache 里历史 K/V | **追加** 新 K/V 列 |

```
Prefill:  [t1][t2][t3][t4]  →  一次前向，Cache 存 K/V for t1..t4

Decode:   生成 t5  →  只算 t5 的 q5,k5,v5
          Attn(q5, [k1..k5], [v1..v5])  ← k1..k4,v1..v4 从 Cache 读
          再把 k5,v5 写入 Cache
```

**Prefill** 偏计算密集（矩阵大）；**Decode** 偏内存带宽（读长 Cache + 小矩阵乘）。

## 三、Decode 一步流程

对新 token（列向量 $\mathbf{x}_\text{new}$，形状 `[d, 1]`）：

1. **投影**：$\mathbf{q}_\text{new}, \mathbf{k}_\text{new}, \mathbf{v}_\text{new} = W_q \mathbf{x}, W_k \mathbf{x}, W_v \mathbf{x}$
2. **读 Cache**：取出历史 $\mathbf{K}_\text{cache}, \mathbf{V}_\text{cache}$（形状 `[d_kv, S]`）
3. **Attention**：
   $$
   \text{Attn}(\mathbf{q}_\text{new},\, [\mathbf{K}_\text{cache} \mid \mathbf{k}_\text{new}],\, [\mathbf{V}_\text{cache} \mid \mathbf{v}_\text{new}])
   $$
4. **写 Cache**：将 $\mathbf{k}_\text{new}, \mathbf{v}_\text{new}$ **追加**到 Cache 末尾
5. **后续**：残差、FFN、LayerNorm… →  logits → 采样下一个 token

多头 / GQA 时，Cache 按 **K/V head** 分块存储；GQA 下 $h_\text{kv} < h_q$，Cache 更小（[第 10 篇](/2026/07/08/大模型数学速成（10）：GQA-分组查询注意力/)）。

## 四、显存估算

单层、单请求、序列长度 $S$，KV 元素数（float32，4 字节）：

$$
\text{KV 字节} \approx 2 \times L \times h_\text{kv} \times d_\text{head} \times S \times 4
$$

| 符号 | 含义 |
|------|------|
| $L$ | Transformer 层数 |
| $h_\text{kv}$ | K/V head 数（MHA 时 = $h_q$；GQA 时更小） |
| $d_\text{head}$ | 每头维度 $d / h_q$ |
| $S$ | 当前上下文长度（prompt + 已生成） |

**例**：$L=32$，$h_\text{kv}=8$，$d_\text{head}=128$，$S=8192$，float16（2 字节）：

$$
2 \times 32 \times 8 \times 128 \times 8192 \times 2 \approx 1\ \text{GB}
$$

batch 为 $B$ 时再乘 $B$。这就是为什么 **GQA、量化 Cache（FP8/INT8）、PagedAttention** 等优化是工程刚需。

## 五、与 GQA 的关系（复习）

| 配置 | $h_\text{kv}$ | 相对 MHA 的 Cache |
|------|---------------|-------------------|
| MHA | $h_q$ | 100% |
| GQA（$g=4$） | $h_q/4$ | ~25% |
| MQA | $1$ | ~$1/h_q$ |

Cache **只存 K 和 V**，不存 Q——Decode 每步的 Q 只针对最新 token，算完即用。

## 六、多模态与共享 Cache

视觉-语言模型（VLM）Prefill 可能包含：

- **文本 token** 的 K/V
- **图像 patch token** 的 K/V（ViT 编码后并入序列，见 [第 08 篇](/2026/07/06/大模型数学速成（08）：ViT层与LLM层-概念对照总表/)）

Decode 生成文本时，**图像部分的 K/V 通常不变**，一直留在 Cache 里复用——同一段对话里不必每步重算图像编码。工程上常区分：

- **静态 Cache**：prompt + 图像（Prefill 写入，Decode 只读）
- **动态 Cache**：新生成 token 的 K/V 持续追加

具体实现因框架而异，数学本质相同：**按位置缓存 K/V 列，Attention 时拼接查询**。

## 七、系列回顾：从矩阵到推理

| 篇号 | 主题 | 与 KV Cache 的关系 |
|------|------|-------------------|
| 01–02 | 张量、矩阵乘 | Cache 是 `[d_kv, S]` 的 K/V 矩阵 |
| 03 | Q/K/V 投影 | Cache 存的是投影后的 K、V |
| 05 | Attention | Decode 用 Cache 避免重算历史 K/V |
| 09 | 多头 | Cache 按 head 组织 |
| 10 | GQA | 减少 $h_\text{kv}$，缩小 Cache |
| **11** | **KV Cache** | Prefill/Decode 与显存 |

## 八、小结

| 概念 | 要点 |
|------|------|
| **动机** | 避免 Decode 时 $O(S^2)$ 重复计算 |
| **Prefill** | 整段 prompt 一次前向，初始化 Cache |
| **Decode** | 每步 1 token，读 Cache + 追加新 K/V |
| **显存** | $\propto L \cdot h_\text{kv} \cdot d_\text{head} \cdot S$ |
| **GQA** | 降低 $h_\text{kv}$，直接省 Cache |

> 大模型数学速成**第一季 11 篇完结**。感谢跟读——从「列 = token」到 KV Cache，希望再读 Transformer 论文或 config 时，公式能对上号。续篇从 [第 12 篇：输出层、Logits 与交叉熵](/2026/07/10/大模型数学速成（12）：输出层、Logits-与交叉熵/) 起，补训练目标与解码等数学。

### 全系列导航

| 篇号 | 标题 |
|------|------|
| 00 | [读 Transformer 前需要哪些数学？](/2026/06/28/大模型数学速成（00）：读Transformer前需要哪些数学/) |
| 01 | [张量、维度与「列 = token」](/2026/06/29/大模型数学速成（01）：张量维度与列等于token/) |
| 02 | [矩阵乘法：神经网络的基本变换](/2026/06/30/大模型数学速成（02）：矩阵乘法-神经网络的基本变换/) |
| 03 | [Q/K/V 投影](/2026/07/01/大模型数学速成（03）：QKV投影-同一输入三种角色/) |
| 04 | [LayerNorm、RMS Norm 与残差](/2026/07/02/大模型数学速成（04）：LayerNorm-RMSNorm与残差连接/) |
| 05 | [注意力机制与 Softmax](/2026/07/03/大模型数学速成（05）：注意力机制与Softmax/) |
| 06 | [FFN：GELU 与 SwiGLU](/2026/07/04/大模型数学速成（06）：前馈网络FFN-GELU与SwiGLU/) |
| 07 | [RoPE](/2026/07/05/大模型数学速成（07）：RoPE-用旋转编码位置/) |
| 08 | [ViT 层 vs LLM 层](/2026/07/06/大模型数学速成（08）：ViT层与LLM层-概念对照总表/) |
| 09 | [多头注意力](/2026/07/07/大模型数学速成（09）：多头注意力-多个专家各看各的/) |
| 10 | [GQA](/2026/07/08/大模型数学速成（10）：GQA-分组查询注意力/) |
| **11** | **KV Cache（本篇，第一季收官）** |
| 12 | [输出层、Logits 与交叉熵](/2026/07/10/大模型数学速成（12）：输出层、Logits-与交叉熵/) |

完整大纲见工作区 `docs/MATH_SERIES_OUTLINE.md`。
