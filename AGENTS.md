# Project guide

这个仓库的项目知识入口是 [`knowledge/README.md`](knowledge/README.md)。开始工程任务时，先读该入口和 [`knowledge/state/CURRENT.md`](knowledge/state/CURRENT.md)，再按任务读取相关契约、路线图或决策；无需预读整个目录。

实现以用户当前要求为准，默认做最小充分修改。完成后只更新被本次工作改变的知识：产品或架构边界写入 `knowledge/contracts/`，持久取舍写入 `knowledge/decisions/`，阶段位置写入 `knowledge/state/CURRENT.md`，重要实施与验证记录写入 `knowledge/logs/`。代码、测试和 Git 历史仍是实现与验证的原始依据，知识库只记录便于后续接手的事实和原因。
