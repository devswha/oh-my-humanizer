---
pattern: 25
type: failure
name: 结构性重复
pack: zh-structure
language: zh
---

# Pattern 25 (zh): 结构性重复 — 失败案例（误报）

## 输入文本

> **iPhone 15 Pro：** A17 Pro芯片CPU提升10%，视频播放续航23小时，起售价999美元。
>
> **Galaxy S24 Ultra：** Snapdragon 8 Gen 3性能接近A17，电池容量5000mAh，起售价1299美元。
>
> **Pixel 8 Pro：** Tensor G3更重视AI功能，续航约24小时，起售价999美元。

## 期望输出

> （不修改 — Pattern 25 不应触发这段文本）

## 适用模式

- Pattern 25 (结构性重复): 三个段落按芯片、续航、价格重复。

## 判定

**失败（误报）** — 这是产品对比的逐项列示格式，重复标签便于查找，因此保留。三行列出的性能、电池容量和续航时间并非同一测量口径，不能称为已验证的公平比较；这里只判断格式排除条件。
