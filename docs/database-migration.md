# 随时可迁移的业务数据

## 与供应商分离

业务UI只调用固定的应用API，`dist/supabase-adapter.js`负责Supabase接线；本地Python/SQLite是第二个已实现适配。更换数据库时替换适配或后端，不需重写订单、劳工表单。

**通用备份格式**：UTF-8 JSON，`format: "zy-labour-portable"`、`version: 1`、`exportedAt`、`orders[]`、`workers[]`。保留记录ID、公司单号、原单、工资原格式、价格状态、所有业务字段、创建/更新时间、教育/工作经历、照片与已存在的原PDF data URL。不要把迁移当成修正旧状态或繁简转换；导出/还原按原值保留。

账号、密码哈希、供应商JWT、登录会话、成员角色和维护设置**不属于此业务备份**。换供应商时管理员/员工需重新开通或另做受控的身份迁移，不能声称业务JSON能恢复账号密码。记录版本在新库重新从1计数。

备份含身份证、电话和照片等个人资料，保存到私密位置，不能提交GitHub或放入 `dist`。`.gitignore`排除 `backups/`、`exports/`、SQLite文件；导出命令禁止输出到公开目录，但仍需人工检查待提交内容。

## 标准迁移步骤

1. 先在目标服务建立结构与新的管理员，保持业务库为空。在迁移前做一次演练；旧站和旧库保持可回退。
2. 原站管理员「账号设置 → 暂停业务写入」。数据库会等待在途业务写操作结束，再进入只读；不是只把按钮变灰。订单、劳工、导入写入一并阻止，读取和导出继续可用。
3. 导出**完整业务资料**作为最终JSON。另保留原库原生备份（PostgreSQL可用受控的pg_dump，SQLite用online backup API）。免费Supabase的自动备份/PITR可用性与付费版不同，不能依赖未开通的服务。
4. 用 `python3 scripts/portable.py inspect --input /private/backup.json` 校验文件和版本，记录订单数、劳工数、SHA-256；命令不打印个人资料内容。
5. 在目标空库通过管理员「恢复到空数据库」选JSON；服务端验证整个文件、重复ID和单号，在同一事务中还原。格式错误、非空目标或并发变动会拒绝，不能部分覆盖现有数据。超过32MB的浏览器文件不支持直接上传，需先使用受控数据库迁移工具或扩展流式导入后再迁移，不能假定无限大小已支持。
6. 从目标再导出一份完整JSON，比较orders/workers实际值（`exportedAt`不同属正常；对象键顺序不重要）。核对照片、附件、原单、工资、日期、数量，并验证目标账号权限与双浏览器共享。
7. 切换公开网址/配置，让所有人使用目标；原站保持只读。明确停用旧入口，避免双方都写形成分叉。
8. 稳定后按业务保留要求处理旧库和备份。若回退，先暂停新库，导出新写入的数据并规划合并，不直接恢复旧站写入丢掉新记录。

## SQLite与PostgreSQL互迁

从Supabase网页导出的JSON可直接恢复到SQLite业务库：

```sh
python3 scripts/portable.py inspect --input /private/backup.json
python3 scripts/portable.py import-sqlite --db /private/new.sqlite3 --input /private/backup.json
python3 scripts/portable.py export-sqlite --db /private/new.sqlite3 --output /private/roundtrip.json
```

导入仅允许空业务库；可保留预先创建的本地账号。新文件路径可创建新库，但不会自动产生管理员；用 `server/app.py create-admin --db /private/new.sqlite3` 私密交互建立。导出文件路径必须不存在，不会覆盖旧备份。

SQLite导出的JSON也可在新的Supabase空库通过 `zy_import` 还原。这条PostgreSQL→SQLite→PostgreSQL路径已在嵌入式真实PostgreSQL引擎测试，逐值验证订单、照片、原PDF和经历不变；尚未在用户真实Supabase项目、网络和大数据量上验证。

未来采用其他PostgreSQL/MySQL服务时，可按相同JSON字段建立导入器；此仓库没有实现所有数据库驱动或承诺一键切换到任意服务。
