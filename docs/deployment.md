# 免费网页式管理系统

默认：静态网页托管 + Supabase Free（PostgreSQL、Auth、账号管理Edge Function）。不使用付费Render磁盘，不自动升级或创建账单。免费方案存在容量、流量、函数调用和项目休眠限制；开通时以官方当前额度为准。尤其照片/PDF的data URL会占数据库容量，须定期完整导出，接近免费额度前迁移。此仓库不会保证永久免费、无限容量或24小时不休眠。

## 先建立免费Supabase项目

1. 在 https://supabase.com/dashboard 建立账号和 **Free** 项目，不选付费方案。数据库密码只在平台安全保存，不要发到聊天或写入仓库。
2. 在SQL Editor执行 `supabase/migrations/202611030001_zy_shared.sql`。业务表位于非公开的 `zy_private` schema，启用RLS并撤销匿名/登录用户直接表权限；客户端只调用明确授权的RPC。不要把 `zy_private` 加到PostgREST exposed schemas，不要放开表权限。
3. 在Authentication设置关闭新用户公开注册（Allow new users to sign up）。管理员建立团队账号；即使Auth里有非团队用户，RPC也会拒绝其读写。
4. 在Authentication → Users用管理面板建立自己的真实邮箱账号和至少12字符密码。只在该私密面板输入密码。然后在SQL Editor执行以下语句，将示例邮箱换为该账号邮箱。确认返回且仅返回一行：

```sql
insert into zy_private.members(id,username,role,active)
select id,email,'admin',true from auth.users where email='YOUR_OWNER_EMAIL'
returning id,username,role;
```

不得给首次网页访客自动授予管理员。此SQL只能由项目所有者在管理面板执行；没有公开bootstrap API。

5. 在项目API设置获取项目HTTPS网址及**公开publishable key（或旧版anon key）**。这些是网页公开配置，可放GitHub repository variables。**绝不能**把 `service_role`、`sb_secret`、数据库密码或Auth管理员凭据放进网页。
6. 为团队账号开通功能部署 `supabase/functions/team-admin/index.ts`。可在函数面板创建 `team-admin` 并复制该单文件，或用Supabase CLI：`supabase functions deploy team-admin --project-ref YOUR_PROJECT_REF`。`supabase/config.toml` 设置verify_jwt=false，因为函数将调用者的真实Bearer JWT交给Postgres RPC校验（兼容新签名密钥）；函数内部仍严格要求有效团队管理员，并非匿名开放管理。
7. 在Edge Function secrets设置 `ZY_ALLOWED_ORIGINS` 为真实网页来源，多个用英文逗号分隔，例如 `https://OWNER.github.io`。不带仓库路径或末尾斜线。Supabase默认注入 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，不要把最后一个复制到网页或聊天。函数对未授权Origin一律拒绝；先无Origin部署不会开放账号创建。

账号创建通过Edge Function在Auth中创建账号，再以调用者权限建立成员；后一步失败时尝试撤回刚建立的Auth账号。若服务中断留下Auth孤立账号，没有团队成员记录，仍无法读取业务数据，可在管理面板清理。账号停用直接更新数据库成员状态，尚未过期的旧JWT也不能继续调用业务RPC。

## 免费托管网页（任选一种，不需要两种都开）

### GitHub Pages

GitHub Free上的Pages通常要求公有仓库；若仓库是私有的，不要为此擅自改成公有或购买套餐，改用下方静态托管方式。仓库代码可以公开，但真实业务数据、备份、密码不能公开。

1. 审阅并提交/推送本仓库代码（本会话尚未推送）。
2. 当前 `dist/config.js` 已包含用户提供的公开项目网址与Publishable key，可直接部署。将来更换项目时，可在仓库Settings → Secrets and variables → Actions → Variables设置 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 覆写；必须同时设置这两个公开值。没有Variables时，构建只使用经过校验的已提交公开配置。
3. Settings → Pages → Build and deployment选择GitHub Actions。
4. Actions手动运行 `Publish free static website`。工作流仅上传 `dist`，不会上传服务器、数据库或备份。生成脚本拒绝管理密钥。完成后使用工作流实际返回的 `page_url`，不能根据仓库名虚构已上线网址。
5. 将实际网址的**来源**填入Edge Function的 `ZY_ALLOWED_ORIGINS`。Supabase Auth → URL Configuration中Site URL设为实际完整网站地址，Redirect URLs只填明确授权地址。当前密码登录没有外部重定向流程。

### Cloudflare Pages静态托管

如果GitHub Pages不适合，可在 https://dash.cloudflare.com 选择Pages的免费静态托管，连接GitHub仓库，构建命令 `python3 scripts/configure_static.py`，输出目录 `dist`，设置两项相同的**公开**环境变量。不需要Workers付费运行时、Python后端、付费数据库或域名，可使用平台分配的域名。将真实来源加入Supabase函数允许列表。免费计划范围以平台开通页面为准。

## 上线验证（尚需在你的真实项目执行）

- 未登录不能读取资料；普通Auth但未加入团队的账号也不能读取。
- 用管理员开通员工邮箱账号，两个独立浏览器分别登录；员工新增单子，管理员在列表约5秒内看到。核对工资原格式、原单及全包价状态。
- 进入编辑时轮询不替换表单；并发修改同单时过期保存必须被拒绝。员工不能开通或停用账号。
- 管理员「账号设置」有完整业务资料导出、空库恢复、暂停写入和恢复写入。
- 停用员工后，即使用原来的登录JWT，请求也被拒绝。密码更新会撤销refresh会话；Supabase已经签发的access JWT通常要等其到期，不能把全局logout当成立即撤销所有access JWT。账号停用的实时数据库检查用于立即阻止业务访问。
- 清除本浏览器登录不会删除团队业务资料；新浏览器可登录读取。

本地PostgreSQL、SQL权限和跨库迁移测试不等于Supabase托管Auth、Edge Function、网络、免费额限制或公开域名已验证。当前没有你的Supabase项目/托管授权，因此没有部署、公开网址或任何收费资源。

## 本地与自托管后备

`npm start` 使用保留的Python/SQLite适配，不需要Supabase账号。首次通过私密终端 `python3 server/app.py create-admin --username owner` 建立本地账号，密码走getpass。SQLite库在被Git忽略的 `var/`；此模式只作本地测试或未来自托管后备，不再作为需要付费主机的默认上线方案。

`npm run start:static` 查看静态版本；未配置云端时只显示“免费云端尚未连接”，不会把保存静默降级到浏览器。直接修改 `dist/config.js` 只填公开配置，或设置上述环境变量后运行 `python3 scripts/configure_static.py`。

本地HTTP与生产HTTPS配置、SQLite完整磁盘备份方法见README；业务数据迁移请按 [数据库迁移](database-migration.md)。
