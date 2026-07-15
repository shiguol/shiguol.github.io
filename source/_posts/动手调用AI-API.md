---
cover: /images/cover/ai/ai-api.webp
title: 动手调用 AI API
date: 2026-06-20 22:50:00
categories:
  - AI
tags:
- AI
- 编程
- 2026
- API
- OpenAI
- 实战
- LLM
---

理论讲了整整 11 篇，从神经网络到 Transformer，从训练到推理，我们已经把 AI 的核心概念过了一遍。但纸上谈兵终究不过瘾——今天这最后一篇，我们用 10 分钟写一个能跑的 AI 程序，让大模型真正为你干活。

<!-- more -->

## 1. 准备工作

要调用 AI，你需要两样东西：一把"钥匙"和一个"工具箱"。

**获取 API Key（钥匙）**

API Key 就像餐厅的会员卡——你出示它，服务员才知道该把账记在谁头上。目前主流的大模型服务商都提供 API 接入：

- **Claude（Anthropic）**：前往 [console.anthropic.com](https://console.anthropic.com) 注册账号，进入 API Keys 页面，点击"Create Key"即可生成。
- **OpenAI**：前往 [platform.openai.com](https://platform.openai.com) 注册，在 API keys 页面创建。

拿到 Key 之后，把它存到环境变量里，千万不要写死在代码中（泄露了别人就能拿你的额度花钱）：

```bash
# Mac / Linux
export ANTHROPIC_API_KEY="sk-ant-xxxxx"

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-xxxxx"
```

**安装 SDK（工具箱）**

SDK 是官方提供的 Python 库，帮你把"组装 HTTP 请求"这件苦差事包装成一行代码。打开终端，选一个安装：

```bash
# Claude
pip install anthropic

# OpenAI
pip install openai
```

本文以 Claude 为主进行演示。如果你用 OpenAI，代码结构几乎一样，只是类名和参数稍有不同。

---

## 2. 第一个请求：Hello World

万事俱备，我们来发第一条消息。这就像给 AI 发一条微信，然后等它回复：

```python
import anthropic

# 创建客户端，自动读取环境变量中的 ANTHROPIC_API_KEY
client = anthropic.Anthropic()

# 发送一条消息
message = client.messages.create(
    model="claude-sonnet-4-6",          # 选择模型
    max_tokens=1024,                     # 最多回复多少个 token
    messages=[
        {"role": "user", "content": "用一句话解释什么是 API"}
    ]
)

# 打印回复
print(message.content[0].text)
```

运行这段代码，你会看到 Claude 用一句话给你解释了 API 的含义。就这么简单——三步走：创建客户端、组装消息、拿到回复。

几个关键参数解释一下：

- **model**：选哪个模型。`claude-sonnet-4-6` 是性价比很高的选择，速度快、智商够用。如果你需要最强能力，可以换成 `claude-opus-4-8`。
- **max_tokens**：限制回复的最大长度。1 个 token 大约等于一个汉字或半个英文单词。
- **messages**：对话内容，是一个列表，每条消息有角色（user 或 assistant）和内容。

---

## 3. 流式输出：打字机效果

上面的代码有个小问题：它要等 AI 把整段话全想完才一次性返回。如果回复很长，用户会盯着空白屏幕干等，体验很差。

流式输出（Streaming）就像看别人在微信里"正在输入……"，文字一个字一个字地蹦出来，用户看着心里踏实：

```python
import anthropic

client = anthropic.Anthropic()

# 用 stream 方法代替 create
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "给我讲一个关于程序员的笑话"}
    ]
) as stream:
    for text in stream.text_stream:
        # 每收到一小段文字就立刻打印，不换行
        print(text, end="", flush=True)

# 最后换个行
print()
```

核心变化只有两处：

1. 把 `create` 换成 `stream`，并用 `with` 语句管理连接。
2. 用 `for text in stream.text_stream` 逐段接收文字。

如果你正在做一个聊天界面，流式输出几乎是必备的——ChatGPT、Claude 网页版用的都是这个技术。

---

## 4. 多轮对话：让 AI 拥有"记忆"

试试连续问 AI 两个问题：

> 用户：我叫小明。
> AI：你好小明！
> 用户：我叫什么名字？

如果每次请求都只发最后一句，AI 根本不知道你之前说了什么——它天生没有记忆。

解决方法很简单：**把整段对话历史都塞进 messages 列表里**。就像把聊天记录截图发给一个失忆的朋友，他看完截图就能接上话：

```python
import anthropic

client = anthropic.Anthropic()

# 维护一个对话历史列表
conversation = []

def chat(user_input):
    # 把用户的新消息追加到历史中
    conversation.append({"role": "user", "content": user_input})

    # 把完整历史发给 AI
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=conversation
    )

    # 拿到回复
    assistant_message = response.content[0].text

    # 把 AI 的回复也追加到历史中（下次发送时 AI 就能看到）
    conversation.append({"role": "assistant", "content": assistant_message})

    return assistant_message

# 模拟多轮对话
print(chat("我叫小明，我是一个 Python 程序员"))
print(chat("我叫什么名字？我会什么编程语言？"))
print(chat("根据我的背景，推荐一个适合我的开源项目"))
```

运行后你会发现，第二轮和第三轮 AI 都能准确地记住你的名字和背景。

要注意的是，对话越长，发送的 token 越多，费用也越高。实际项目中通常会设置一个历史长度上限，或者在对话太长时做摘要压缩。

---

## 5. Tool Use：让 AI 调用你的函数

大模型虽然知识渊博，但它有两个死穴：**不知道实时信息**（比如今天天气）、**算数不靠谱**（大数乘法经常算错）。

Tool Use（工具调用）就是给 AI 配一套"外挂"——你定义好函数，告诉 AI 有哪些工具可用，AI 需要的时候会自己决定调用哪个，把参数填好发给你，你执行完再把结果告诉它。

```python
import anthropic
import json

client = anthropic.Anthropic()

# 第一步：定义工具（告诉 AI 有哪些函数可以用）
tools = [
    {
        "name": "get_weather",
        "description": "查询指定城市的当前天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名称，如：北京"
                }
            },
            "required": ["city"]
        }
    }
]

# 第二步：你自己实现这个函数（实际项目中会调用天气 API）
def get_weather(city):
    # 这里用模拟数据演示
    fake_data = {"北京": "晴天，32°C", "上海": "多云，28°C"}
    return fake_data.get(city, f"{city}：暂无数据")

# 第三步：发送请求，带上工具列表
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "北京今天天气怎么样？"}]
)

# 第四步：检查 AI 是否想调用工具
if response.stop_reason == "tool_use":
    # 找到工具调用的内容块
    for block in response.content:
        if block.type == "tool_use":
            # 执行函数，拿到结果
            result = get_weather(block.input["city"])

            # 把结果返回给 AI，让它组织最终回复
            final = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                tools=tools,
                messages=[
                    {"role": "user", "content": "北京今天天气怎么样？"},
                    {"role": "assistant", "content": response.content},
                    {"role": "user", "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result
                        }
                    ]}
                ]
            )
            print(final.content[0].text)
```

整个流程就像你和一个秘书的配合：

1. 你告诉秘书："你可以查天气、查股票"（定义工具）。
2. 用户问了一个需要查天气的问题。
3. 秘书说："我需要调用查天气功能，参数是北京"（AI 返回 tool_use）。
4. 你去查了天气，把结果告诉秘书（发送 tool_result）。
5. 秘书根据结果，用自然语言回答用户。

Tool Use 是构建 AI Agent（智能体）的核心机制——让 AI 不只是"说"，还能"做"。

---

## 6. 费用控制：花钱要花在刀刃上

调用 API 是要花钱的，按 token 计费。以下是一些主流模型的价格参考（每百万 token）：

| 模型 | 输入价格 | 输出价格 | 适用场景 |
|------|---------|---------|---------|
| Claude Haiku 4.5 | $1 | $5 | 简单任务、分类、提取 |
| Claude Sonnet 4.6 | $3 | $15 | 日常开发、平衡之选 |
| Claude Opus 4.8 | $5 | $25 | 复杂推理、长程任务 |

**怎么估算成本？**

1 个 token 大约是 1 个汉字或 0.75 个英文单词。一次普通对话大概消耗几百到几千 token，花费通常在几分钱到几毛钱之间。

**省钱小技巧：**

- **选对模型**：简单问题用 Haiku，别杀鸡用牛刀。
- **控制 max_tokens**：不需要长篇大论就把上限设低。
- **精简 prompt**：系统提示词不要写小作文，言简意赅效果更好。
- **善用缓存**：如果你反复发送相同的系统提示词，可以使用 Prompt Caching（提示缓存），读缓存只需要原价的十分之一。
- **用 Batch API**：对时效性要求不高的批量任务，用批处理接口可以直接打五折。

你可以在代码里通过 `response.usage` 随时查看本次请求消耗了多少 token：

```python
print(f"输入 token: {response.usage.input_tokens}")
print(f"输出 token: {response.usage.output_tokens}")
```

---

## 7. 下一步去哪

恭喜你读完了"小白讲 AI"全部 12 篇！从零基础到能写代码调用大模型，你已经走了很远。接下来可以往这些方向深入：

**官方文档（必读）**

- [Anthropic 官方文档](https://docs.anthropic.com) —— Claude API 的权威参考，包含所有功能的详细说明和示例。
- [OpenAI 官方文档](https://platform.openai.com/docs) —— GPT 系列的文档，结构清晰。

**动手项目（推荐）**

- 做一个命令行聊天机器人（多轮对话 + 流式输出）。
- 做一个文档问答助手（把 PDF 内容喂给 AI，让它回答问题）。
- 做一个带工具的智能体（让 AI 查数据库、发邮件、操作文件）。

**社区与资源**

- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) —— 官方示例集，涵盖各种实战场景。
- [LangChain](https://github.com/langchain-ai/langchain) —— 流行的 AI 应用开发框架，帮你快速搭建复杂应用。

AI 的世界才刚刚打开大门。理论给你方向感，代码给你行动力。现在，该你上场了。

---

**延伸阅读**

1. [Anthropic API 官方文档](https://docs.anthropic.com) —— 最权威的 Claude API 参考，包括 Tool Use、Streaming、Prompt Caching 等高级功能
2. [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) —— 官方代码示例集，从入门到进阶的实战案例
3. [Prompt Engineering 指南](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) —— 如何写出高质量的提示词，让 AI 更好地理解你的意图
