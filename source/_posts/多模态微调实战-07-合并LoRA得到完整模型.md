---
cover: /images/cover/vlm/merge-lora.webp
title: 多模态微调实战（07）：合并 LoRA 得到完整模型
date: 2026-07-27 09:00:00
categories:
  - VLMFinetune
tags:
  - 多模态
  - VLM
  - 微调
  - LoRA
  - merge_lora
  - ms-swift
  - 2026
---

LoRA checkpoint 很小，但推理时需要「基座 + adapter」。若要交给只接受普通 HF 目录的下游，或继续转 GGUF，通常先 **merge**。这一篇讲合并在做什么、怎么做、合完怎么验。

<!-- more -->

> 这是「多模态微调实战」的第 07 篇。合并是从「训练产物」走向「可部署模型」的关键一步。

## 一、合并在做什么

把 LoRA 低秩更新写回基座线性层，导出一份**独立完整权重**：

```text
基座 Qwen3-VL-4B  +  adapter(checkpoint-XXXXX)  →  merged model directory
```

合并后：

- 不再依赖 `--adapters`；
- 目录结构接近普通 Transformers 模型；
- 体积接近基座（数 GB～十余 GB），而不是 LoRA 的几百 MB。

## 二、命令

ms-swift：

```bash
swift export \
  --model /workspace/model/Qwen3-VL-4B-Instruct \
  --adapters /workspace/output/ocr_plate_lora_full/.../checkpoint-93000 \
  --merge_lora true \
  --output_dir /workspace/output/ocr_plate_merged_checkpoint-93000
```

脚本化示例：

```bash
bash script/merge_lora.sh \
  output/ocr_plate_lora_full/.../checkpoint-93000
```

建议输出目录带上 checkpoint 名，避免覆盖：`output/ocr_plate_merged_checkpoint-93000/`。

## 三、成功长什么样

合并通常很快（分钟级，视磁盘与是否上 GPU 而定）。成功后目录大致包含：

```text
ocr_plate_merged_checkpoint-93000/
├── config.json
├── generation_config.json
├── model-00001-of-00002.safetensors
├── model-00002-of-00002.safetensors
├── model.safetensors.index.json
├── tokenizer.json
├── tokenizer_config.json
├── preprocessor_config.json
├── processor_config.json
└── chat_template.jinja   # 视版本而定
```

体积量级举例：约 **8GB+**（bf16 / 分片保存）。

## 四、合并谁？93000 还是最终 step？

回顾训练监控：

- 框架可能把 **验证 loss 最低** 的点标为 `best_model_checkpoint`；
- 最终 step 是「训完时的模型」，不一定 loss 最优。

务实策略：

1. 若暂时只合一份：优先合 **best（如 93000）**；
2. 磁盘够：best 与 final 都合，用同一评测脚本对比；
3. 以业务 Exact Match / 人工抽检为准，而不是只看一个标量 loss。

## 五、合并后如何冒烟测试

最小验证：

```bash
# 容器内
swift infer \
  --model /workspace/output/ocr_plate_merged_checkpoint-93000 \
  --stream true
```

或跑你的批量评测脚本，确认：

- 能加载；
- 输出格式仍符合训练标签规范；
- 指标与「基座+adapter」推理接近（允许极小数值差）。

## 六、常见问题

| 现象 | 处理 |
|------|------|
| 找不到 adapter | 路径是否是容器内路径；目录是否含 `adapter_model.safetensors` |
| 合并后缺 tokenizer | 检查 export 日志是否完整；必要时从基座目录拷贝缺失文件 |
| 显存不够 | 合并可尝试 CPU offload / 调整 device_map（视 ms-swift 版本参数） |
| 覆盖了旧产物 | 输出目录加 checkpoint 后缀 |

## 七、小结

合并完成标志：

1. 独立模型目录可被 Transformers / ms-swift 直接加载；
2. 冒烟推理正常；
3. 准备进入量化或业务部署。

> 多模态微调实战第 07 篇完。下一篇：把合并后的模型导出 GGUF、量化到 INT4，并做部署侧验收。
