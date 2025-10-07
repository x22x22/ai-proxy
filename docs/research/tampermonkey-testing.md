# 油猴脚本单元测试与集成测试调研报告

> 目标：为 AI agents 编写和维护 Tampermonkey（油猴）脚本时提供可复用的单元测试与集成测试实践范式。

## 目录
1. [油猴脚本测试的特殊性](#油猴脚本测试的特殊性)
2. [单元测试策略](#单元测试策略)
   1. [脚本模块化与可测试性设计](#脚本模块化与可测试性设计)
   2. [案例：trim21/bgm-tv-userscripts 的 Jest 测试流水线](#案例trim21bgm-tv-userscripts-的-jest-测试流水线)
3. [集成 / 端到端测试策略](#集成--端到端测试策略)
   1. [案例：DawnbrandBots/deck-transfer-for-master-duel 的 Playwright 回归测试](#案例dawnbrandbotsdeck-transfer-for-master-duel-的-playwright-回归测试)
4. [构建与测试自动化建议](#构建与测试自动化建议)
5. [给 AI agents 的落地指南](#给-ai-agents-的落地指南)

## 油猴脚本测试的特殊性

* **执行环境混合**：脚本运行在浏览器用户态，既能访问 DOM，也能调用 Tampermonkey 提供的 GM_* API。测试时需要在 Node.js 与浏览器模拟之间切换。
* **部署形态单一**：最终产物通常是单文件 IIFE，需要通过 `@require` 或打包流程引入模块。测试阶段必须拆分源代码或暴露测试入口。
* **权限与外部依赖**：脚本往往依赖跨域访问、持久化存储或登录态，在自动化测试中需要模拟或注入这些能力。

## 单元测试策略

### 脚本模块化与可测试性设计

* 将脚本核心逻辑与 Tampermonkey 容器解耦，抽取为独立模块，再在最终脚本中通过 `@require` 引入。WaniKani 社区的讨论指出，常见做法是把函数、类放在独立文件中，然后通过 `@require` 或挂载到全局对象暴露给测试用例，从而符合 Jest 等模块化框架的 `require` 约定。[^wanikani]
* 在顶层 IIFE 中仅保留执行入口，避免导入时立即运行的副作用。可以通过 `window.myscript.test = { ... }` 暴露接口，或导出纯函数给单元测试调用。[^wanikani]

### 案例：trim21/bgm-tv-userscripts 的 Jest 测试流水线

* **项目结构**：脚本源码与测试位于 `scripts/<name>/src`，通过 Webpack 把 TypeScript 编译成 `.user.js`，同时使用 `ts-jest` 跑单元测试。
* **Jest 配置**：项目提供了 `jest.config.js`，启用 `ts-jest` 预设，并在 `transform` 中指向 TypeScript 编译管线，从而让 `.ts` 源码直接参与测试。[^trim21-jest-config]
* **测试示例**：`scripts/hover-subject-info/src/util.spec.ts` 验证 `getSubjectID` 的路径解析逻辑，覆盖合法 / 非法 URL，确保提取出的 subject ID 正确。[^trim21-util-test][^trim21-utils]
* **依赖管理**：`package.json` 中同时声明了 `jest`、`@jest/globals`、`ts-jest`、`@types/greasemonkey` 等依赖，说明在 Node 环境完成逻辑验证，再通过 Webpack 生成油猴脚本。[^trim21-package]

> **对 AI agent 的启示**：可以将待测函数独立成模块，使用 `ts-jest` 或 `babel-jest` 运行单元测试；GM_* API 可以通过 jest.mock 或封装适配层进行模拟。

## 集成 / 端到端测试策略

### 案例：DawnbrandBots/deck-transfer-for-master-duel 的 Playwright 回归测试

* **测试目标**：该项目同时发布浏览器扩展与油猴脚本，Playwright 测试通过加载打包后的扩展，实现对脚本实际注入页面后的 UI 验证。`test/fixtures.ts` 使用 `chromium.launchPersistentContext` 配置 `--disable-extensions-except` 和 `--load-extension`，确保待测脚本随浏览器上下文一起加载。[^dawn-fixtures]
* **分层测试**：
  * `disabled-smoke.spec.ts` 作为基线，验证未加载脚本时页面无扩展按钮。[^dawn-disabled]
  * `enabled-smoke.spec.ts` 验证脚本注入后生成的按钮、文案与可见性。[^dawn-enabled]
  * `functional.spec.ts`/`functional-login.spec.ts` 组合登录态（通过环境变量注入 Konami Cookies）和真实下载流程，检查脚本对外部服务的集成。[^dawn-functional][^dawn-login]
* **CI 集成**：`.github/workflows/test.yml` 在多个操作系统上运行 `yarn playwright test`，并上传 Playwright HTML 报告，实现跨平台回归。[^dawn-ci]

> **对 AI agent 的启示**：当脚本依赖浏览器真实 DOM、外部站点或登录态时，使用 Playwright/Chrome DevTools 协议加载脚本进行端到端验证，并通过环境变量或测试夹具注入必要的账号信息。

## 构建与测试自动化建议

1. **统一打包与测试入口**：使用 Vite、Webpack 或 Rollup 将源码拆分为模块化结构，保证单元测试与最终 `.user.js` 共用同一源文件。
2. **模拟 GM_* API**：为常用 API（如 `GM_getValue`、`GM_setValue`、`GM_xmlhttpRequest`）提供接口层；在 Jest 中用 `jest.fn()` 模拟行为，在 Playwright 中通过 `page.exposeFunction` 或注入补丁脚本模拟。
3. **多浏览器验证**：Playwright 支持 Chromium、Firefox、WebKit，可根据脚本兼容性配置矩阵；若需测试原生 Tampermonkey，可在测试夹具中加载官方扩展或使用 `userscripts` 插件。
4. **持续集成**：借鉴 DawnbrandBots 的 workflow，在 CI 中安装浏览器依赖、运行 Playwright/Jest 测试，并上传报告与录屏，保证脚本更新后立即验证。

## 给 AI agents 的落地指南

1. **在规划阶段**：识别脚本核心逻辑与浏览器交互层，提前设计模块边界，避免把测试代码直接耦合在 IIFE 中。
2. **搭建单元测试**：
   * 选用 Jest + ts-jest 或 Vitest（如果脚本基于 Vite 构建）。
   * 通过 `@require` 或打包工具把业务模块导出给测试；必要时挂载到 `window` 暴露测试接口。
   * 针对纯函数、数据转换、选择器构造等逻辑编写覆盖用例。
3. **搭建集成测试**：
   * 使用 Playwright 自定义上下文加载脚本，或在 Puppeteer 中手动注入脚本内容。
   * 编写基线用例（未注入脚本）与启用用例对比，确保脚本真正改变了页面行为。
   * 如涉及登录 / API 调用，利用环境变量注入凭证，并在测试后清理状态。
4. **自动化与交付**：在 CI 中串联 `lint → unit test → build → integration test`，失败时保留 Playwright 报告或调试日志，方便回溯。

## 参考资料

[^wanikani]: [Best practices for testing userscripts? - WaniKani Community](https://community.wanikani.com/t/best-practices-for-testing-userscripts/53755) – 讨论了如何通过 `@require` / 全局导出方式让用户脚本适配 Jest 等测试框架。
[^trim21-package]: [trim21/bgm-tv-userscripts – package.json](https://github.com/trim21/bgm-tv-userscripts/blob/master/package.json)
[^trim21-jest-config]: [trim21/bgm-tv-userscripts – jest.config.js](https://github.com/trim21/bgm-tv-userscripts/blob/master/jest.config.js)
[^trim21-util-test]: [trim21/bgm-tv-userscripts – util.spec.ts](https://github.com/trim21/bgm-tv-userscripts/blob/master/scripts/hover-subject-info/src/util.spec.ts)
[^trim21-utils]: [trim21/bgm-tv-userscripts – utils.ts](https://github.com/trim21/bgm-tv-userscripts/blob/master/scripts/hover-subject-info/src/utils.ts)
[^dawn-fixtures]: [DawnbrandBots/deck-transfer-for-master-duel – test/fixtures.ts](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/test/fixtures.ts)
[^dawn-disabled]: [DawnbrandBots/deck-transfer-for-master-duel – test/disabled-smoke.spec.ts](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/test/disabled-smoke.spec.ts)
[^dawn-enabled]: [DawnbrandBots/deck-transfer-for-master-duel – test/enabled-smoke.spec.ts](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/test/enabled-smoke.spec.ts)
[^dawn-functional]: [DawnbrandBots/deck-transfer-for-master-duel – test/functional.spec.ts](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/test/functional.spec.ts)
[^dawn-login]: [DawnbrandBots/deck-transfer-for-master-duel – test/functional-login.spec.ts](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/test/functional-login.spec.ts)
[^dawn-ci]: [DawnbrandBots/deck-transfer-for-master-duel – .github/workflows/test.yml](https://github.com/DawnbrandBots/deck-transfer-for-master-duel/blob/master/.github/workflows/test.yml)
