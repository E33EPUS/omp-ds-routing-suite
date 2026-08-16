# 跑分任务：购物车模块（论文 J 实验复刻）

## 任务说明（直接粘贴给模型）

实现一个 JavaScript 购物车模块 `cart.js`，导出以下功能：

1. `add(item)` — 添加商品；同 id 商品**合并数量**（merge）
2. `remove(id)` — 删除商品
3. `updateQty(id, qty)` — 更新数量；qty <= 0 时删除该商品
4. `subtotal()` — 小计（单价 × 数量之和）
5. `discount(rate)` — 全场折扣（0 < rate < 1，应用到 subtotal）
6. `applyCoupon(code)` — 优惠券：`SAVE10` 减 10 元（不低于 0）、`HALF` 半价，其他 code 报错
7. `snapshot()` / `restore(snap)` — 状态快照与还原（深拷贝，还原后独立）
8. `clear()` — 清空购物车

边界要求：
- 未知商品 id 的 remove/updateQty 抛 `NotFoundError`
- 非法参数（负数数量、非数字价格）抛 `InvalidArgumentError`
- 空购物车 subtotal 为 0

每个功能至少一个导出测试断言（共 ≥10 个断言），用 Node 自带 `node:assert`，`node test.js` 全部通过为完成标准。

## 评分清单（完成度）

| # | 功能 | 通过 |
|---|---|---|
| 1 | add 合并同 id | ☐ |
| 2 | remove 删除 | ☐ |
| 3 | updateQty（含 <=0 删除）| ☐ |
| 4 | subtotal 计算 | ☐ |
| 5 | discount 折扣 | ☐ |
| 6 | applyCoupon SAVE10/HALF/非法 | ☐ |
| 7 | snapshot/restore 深拷贝独立 | ☐ |
| 8 | clear | ☐ |
| 9 | NotFoundError | ☐ |
| 10 | InvalidArgumentError + 空车 subtotal=0 | ☐ |

## 记录表（每个会话跑完填）

- 模式：插件开（weak）/ 插件关（native）
- 完成度：__/10
- 工具调用步数：__
- 出现工具错误次数：__
- 总耗时（分钟）：__
- 是否有过"卡住/重试"：__
- 思维链开头词（看 2-3 个思考块）：__
