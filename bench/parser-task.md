# CSV 解析器任务（E2 任务泛化用，与购物车任务同规格）

实现一个 JavaScript CSV 解析模块 parser.js，导出以下功能：

1. parse(text) — 解析 CSV 文本为行数组（每行是字段数组）
2. 引号规则 — 字段可用双引号包裹；引号内的逗号/换行不算分隔符；引号内双引号（""）转义为单引号
3. 空行跳过 — 空白行不产生记录（但引号内空行是内容）
4. toCSV(rows) — 行数组序列化为 CSV 文本（需要时加引号）
5. 错误处理 — 未闭合引号抛 ParseError；非法参数（非字符串）抛 InvalidArgumentError
6. 边界 — 空输入返回空数组；单字段行正常；末尾换行不产生空记录

边界要求：parse 对格式错误（未闭合引号）必须抛 ParseError；toCSV 对非数组参数抛 InvalidArgumentError。

每个功能至少一个导出测试断言（共 >=10 个断言），用 Node 自带 node:assert，node test.js 全部通过为完成标准。
