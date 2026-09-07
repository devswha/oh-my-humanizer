---
pattern: 20
type: success
name: 训练数据截止声明
pack: zh-communication
language: zh
---

# Pattern 20 (zh): 训练数据截止声明 — 成功案例

## 输入文本

> 截至我的知识截止日期，该公司约有5000名员工。具体数据可能有变化，建议您查阅最新资料。

## 期望输出

> 截至知识截止日期，该公司约有5000名员工；人数可能已有变化，建议查阅最新资料。

## 适用模式

- Pattern 20 (训练数据截止声明): source example from `patterns/zh-communication.md`.

## 判定

**编辑判断（模型审阅）** — 保留知识截止范围、约5000人、不确定性及查阅建议；删除虚构的2024年年报。缺少日期和来源时保留时效限制，不能声称已完成来源补全。
