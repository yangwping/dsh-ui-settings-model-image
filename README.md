# dsh-ui-settings-model-image

> [DSH](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）Web 客户端插件：在 **设置 → Models** 页面为每个模型供应商卡片增加「图片输入」面板，用于配置**逐模型的输入模态**（文本 / 图片）与**请求图片策略**（体积 / 像素预算）。

针对 `llm-pi-ai` 适配器家族的供应商（含手写声明的路由，例如火山引擎 Ark、OpenRouter 等任何以 pi-ai 路由接入的供应商）生效。

---

## 功能

安装并重启 Web 应用后，打开 **设置 → Models**，每个 pi-ai 家族供应商卡片会出现一个可折叠的 **Image input** 面板：

### 1. 模型输入模态（Model input modalities）

- 每个已声明模型一行，一对 `text` / `image` 复选框；
- 直接路由（手写在配置里的 models）编辑模型自身条目；
- 由服务目录（installed catalog）提供模型的路由，则编辑 `modelOverrides.<id>` 条目，遵循适配器自身的解析规则；
- 勾选状态留空（`input: []`）表示继承供应商的 `defaultInput`。

### 2. 请求图片策略（Request image policy）

三个可选字段，**留空表示保持默认值**，输入框占位符会显示当前生效的默认值：

| 字段 | 含义 |
| --- | --- |
| `maxRequestImageBytes` | 单次请求允许的图片总体积上限（字节） |
| `requestImagePixelBudget` | 图片缩放的总像素预算 |
| `requestImageMaxBytes` | 单张图片编码后的最大字节数 |

面板中会以 MB / KB / 百万像素等人类可读格式回显当前值。

### 保存语义

所有编辑先在本地暂存（staging），保存时以带版本栅栏（revision-fenced）的 `settings.mutate` path ops 提交——若其他人并发修改了设置文档，会得到**可见的拒绝**而不是静默覆盖；服务端推送的 `settings/document-updated` 事件会收敛干净的草稿，而保留仍有未保存修改的草稿。

---

## 安装

前置条件：

- 目标机器上已安装 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（开发验证版本 `0.1.2-rc.1`）；
- `pnpm` 在 `PATH` 中（`dsh plugin` 命令转发给 pnpm 执行）。

### 方式一：从本仓库直接安装（推荐）

```bash
dsh plugin --profile web add github:yangwping/dsh-ui-settings-model-image#path:ui-settings-model-image
```

仓库已提交构建产物（`ui-settings-model-image/lib/`），无需在目标机器上构建。
把 `--profile web` 换成你实际使用的 profile 名即可；全新机器没建过 profile 也能直接装（会自动初始化）。

### 方式二：从 npm tarball 安装

在本仓库根目录打包：

```bash
cd ui-settings-model-image
pnpm pack --pack-destination ..
```

把生成的 `deepseek-ai-dsh-client-ui-settings-model-image-0.1.0.tgz` 拷到目标机器，然后：

```bash
dsh plugin --profile web add /path/to/deepseek-ai-dsh-client-ui-settings-model-image-0.1.0.tgz
```

tarball 是自包含的，安装后与源目录再无关联。

### 方式三：从本地目录安装（开发机）

```bash
dsh plugin --profile web add file:/path/to/dsh-ui-settings-model-image/ui-settings-model-image
```

### 安装后

**重启该机器的 Web 应用**（`dsh web`）——bundle 层在启动时快照，运行中的实例不会热加载新装的 bundle。

卸载：

```bash
dsh plugin --profile web remove @deepseek-ai/dsh-client-ui-settings-model-image
```

---

## 兼容性说明

- **平台**：UI 面板只在 Web 客户端（`dsh web`）出现；宿主侧入口是空操作（no-op），因此把插件装进 tui / headless 等非 Web profile 不会报错，也不会产生副作用。
- **版本**：插件与 dsh `0.1.2-rc.1` 一线的客户端模块协议（`window.__ModuleLoader__` bundle 契约）匹配；其他机器请使用相同或更新版本的 dsh。
- **包名**：包名沿用原 `@deepseek-ai/*` scope（loader 行、client bundle 的模块 id 都引用该名字）；本仓库以 git 方式分发，**不需要**在 npm 发布。
- pnpm 安装时出现的 `Issues with peer dependencies found` 警告是预期行为：`@deepseek-ai/cordis` 由宿主在运行时提供，无需安装。

---

## 开发

仓库布局：

```
├── README.md                  # 本文件
├── smoke-test.ts              # 纯逻辑冒烟测试（profile.ts 的读/改/写核心）
├── tsconfig.check.json        # 类型检查配置（paths 指向 DSH 源码仓库，按需调整）
└── ui-settings-model-image/   # 插件包本体
    ├── src/                   #   TypeScript 源码
    ├── lib/                   #   构建产物（已提交，供 git 直装）
    ├── cordis.patch.yml       #   bundle patch：向 web 客户端图插入 loader 行
    └── tsdown.config.dev.ts   #   独立构建配置（不依赖 DSH 源码仓库）
```

### 冒烟测试

```bash
node smoke-test.ts        # Node ≥ 23（原生 TS 类型剥离）
```

### 类型检查

`tsconfig.check.json` 中的 `paths` 原本指向 DSH 源码仓库（deepseek-harness）的路径；在其他机器上需要先调整为本地 deepseek-harness checkout 的实际路径，再执行 `tsc -p tsconfig.check.json`。

### 构建

```bash
cd ui-settings-model-image
pnpm install
pnpm exec tsdown -c tsdown.config.dev.ts    # 产出 lib/index.js + lib/client.js
```

`tsdown.config.dev.ts` 是自包含的独立构建配置，复刻了 DSH 仓库内 `packages/client/tsdown.client.ts` 的两份产物契约：Node loader 入口（`lib/index.js`）与浏览器闭包工厂 bundle（`lib/client.js`，以平台模块表为唯一 externals）。

改完源码后记得重新 `pnpm pack` / 重新 `dsh plugin add`，并重启 `dsh web`。

---

## 许可证

MIT
