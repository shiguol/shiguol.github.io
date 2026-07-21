---
cover: /images/cover/llamafactory/sft-vs-lora.webp
title: 语言模型微调实战（02）：SFT 与 LoRA，别把两个概念搞混
date: 2026-08-03 09:00:00
categories:
  - LLaMAFactorySFT
tags:
  - 大模型
  - 微调
  - SFT
  - LoRA
  - QLoRA
  - 2026
---

常见误区：「我这份数据到底叫 SFT 还是 LoRA？」正确理解是——**数据**属于 SFT（监督微调）数据，**LoRA** 是训练方法。这一篇把两个不在同一层的概念彻底分清。

<!-- more -->

## 两个词不在同一层

| 术语 | 指什么 | 配置里常见字段 |
|------|--------|----------------|
| **SFT** | 训练任务：用「输入 → 标准答案」监督模型 | `stage: sft` |
| **LoRA** | 参数高效微调：冻结基座，只训低秩适配器 | `finetuning_type: lora` |

所以规范的说法是：**用 SFT 数据，做 LoRA 微调。**

## 同一套数据，可以换多种训法

| 方法 | 含义 | 显存压力 | 备注 |
|------|------|----------|------|
| LoRA | 只训适配器 | 低 | 本系列默认 |
| Full | 更新全部参数 | 高 | 适合更大盘数据或冲上限 |
| QLoRA | 量化基座 + LoRA | 更低 | 显存紧张时 |

换方法时，数据集通常不用重做；主要改配置中的微调类型，以及学习率、batch 等超参。

## 配置对应关系（示意）

```yaml
stage: sft
do_train: true
finetuning_type: lora

lora_rank: 8
lora_alpha: 16
lora_target: all
```

训练完成后，可用导出命令把适配器合并进基座，得到可独立加载的完整模型目录。

## 一句话记住

- 问「数据是什么」→ **SFT / 指令微调数据**
- 问「怎么训的」→ **LoRA（或 Full / QLoRA）**
- 问「交付什么」→ **合并后的完整模型**（可选：推理侧 schema 校验）

> 语言模型微调实战第 02 篇完。下一篇进入环境：用 Docker 把 LLaMA-Factory 训练环境固化下来。
