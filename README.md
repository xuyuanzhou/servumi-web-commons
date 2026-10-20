# servumi-web-commons

Servumi 前端的 **API 对接底座**：把壳（`servumi-web`）与各业务 Remote 之间逐字节重复的那几份
`contract.ts` / `request.ts` / `format-error.ts` 收成唯一一份。

## 本包装什么

| 模块 | 内容 |
| --- | --- |
| `envelope.ts` | 服务端统一响应信封 `ApiEnvelope` 与形状校验 `parseEnvelope` |
| `error.ts` | 非 2xx 或 `success=false` 时的统一抛出物 `ApiError` |
| `request.ts` | 请求客户端 `createApiClient`：Bearer 令牌、401 静默刷新重放、`Accept-Language`、会话世代 |
| `format-error.ts` | 错误码 → 本模块目录文案；`errorCode` / `errorStatus` 判定助手 |
| `contract.ts` | Remote 与 Shell 的运行时契约：`PortalPageProps`、`PortalRemoteModule`、`ShellRequest`、路由常量 |

## 本包不装什么

- **身份专用函数**（`login` / `refresh` 之外的 session、权限、安全事件接口）：它们属于
  `servumi-web` 的业务，只有壳会调，放进来会让 Remote 也能调身份接口。
- **界面目录与 `Translator` 实现**：`t` 由壳注入，本包只出类型。
- **React 组件**：本包不含 JSX，保持无框架依赖，元素归各仓。

## 怎么被消费

本包以 **源码** 对外（`exports` 指向 `src/index.ts`），不产出 `dist`：各消费方都是 Vite 构建，
会把链上的依赖当作源码一起转译，因此省掉一次构建与一次版本协商。

消费方在 `package.json` 里按兄弟目录引用：

```json
{
  "dependencies": {
    "servumi-web-commons": "file:../servumi-web-commons"
  }
}
```

本地开发要求本仓与消费方仓位于同一父目录；CI 里由工作流先把本仓取到同级目录再 `npm ci`。

## 校验

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm test
```
