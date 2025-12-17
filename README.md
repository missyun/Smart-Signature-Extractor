# ✍️ Smart Signature Extractor (智能签名提取器)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat&logo=react)
![Electron](https://img.shields.io/badge/Electron-28-47848F.svg?style=flat&logo=electron)
![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=flat&logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat&logo=typescript)

> 一个高颜值的桌面端工具，利用计算机视觉和 AI 大模型技术，快速从扫描件或照片中批量提取手写签名，自动去除背景，并智能识别签名内容进行自动重命名。

---

## ✨ 核心功能 (Features)

### 🎨 智能图像处理
*   **自动去底 (Auto Remove Background)**：基于亮度感知的算法，自动将签名背景转为透明 PNG，完美适配各种文档。
*   **图像增强**：
    *   🪄 **智能漂白 (Smart Bleach)**：去除纸张底色和阴影，增强文字对比度。
    *   👁️ **高清锐化 (Sharpen)**：修复模糊的笔迹，使签名更清晰。
*   **色彩转换**：一键将签名转换为 **黑色**、**红色**、**蓝色**，或自定义任意 Hex 颜色，适应不同签署场景。

### 🧠 AI 辅助识别 (OCR)
*   集成多模态大模型 API，自动识别选区内的手写文字。
*   **自动重命名**：识别成功后，自动将生成的文件重命名为对应的人名，省去手动输入的繁琐。
*   **支持模型**：
    *   🟢 **智谱 AI** (GLM-4V)
    *   🟠 **阿里云百炼** (Qwen-VL)

### 🛠️ 强大的工作区
*   **多种选区工具**：
    *   🔲 **矩形框选 (Rect)**：快速选择标准区域。
    *   ✨ **自由多边形 (Polygon)**：通过打点的方式精确提取不规则形状或密集的签名。
*   **交互操作**：支持无限画布拖拽平移 (空格键/中键)、鼠标滚轮缩放。
*   **批量管理**：支持单图多次提取，提供列表管理与实时预览。

### 📦 本地化与导出
*   支持单张签名下载。
*   **批量导出 ZIP**：一键将所有处理好的签名打包下载。
*   跨平台支持（Windows/macOS），基于 Electron 构建。

---

## 🚀 快速开始 (Getting Started)

### 环境要求
*   Node.js (建议 v16+)
*   npm 或 yarn

### 1. 克隆仓库
```bash
git clone https://github.com/your-username/smart-signature-extractor.git
cd smart-signature-extractor
```

### 2. 安装依赖
**注意**：在运行或打包之前，必须先安装依赖。
```bash
npm install
```

### 3. 开发模式运行 (Dev)
在开发环境下启动 React 前端和 Electron 主进程（支持热重载）：
```bash
npm run dev
```

### 4. 打包构建 (Build)
构建生产环境的安装包（默认生成 Windows .exe，位于 `release` 目录）：
```bash
npm run dist
```
*该命令会自动执行 TypeScript 编译和 Electron Builder 打包流程。*

---

## ⚙️ 配置说明 (Configuration)

为了使用 **AI 自动重命名** 功能，您需要在软件界面的「设置」中配置 API Key。目前支持以下服务商：

1.  **智谱 AI (Zhipu AI)**: 申请 Key 请前往 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2.  **阿里云百炼 (Aliyun)**: 申请 Key 请前往 [阿里云 DashScope](https://help.aliyun.com/zh/dashscope/)

*注：若未配置 API Key，软件仅提供抠图和图像处理功能，提取的文件将使用默认命名。*

---

## 📂 目录结构 (Structure)

```
├── src/
│   ├── components/    # UI 组件 (图标、按钮等)
│   ├── services/      # API 服务 (智谱/阿里云集成逻辑)
│   ├── utils/         # 核心算法 (Canvas 像素处理、抠图算法)
│   ├── App.tsx        # 主应用逻辑与状态管理
│   └── main.cjs       # Electron 主进程入口
├── index.html         # Web 入口文件
├── package.json       # 项目配置与打包脚本
└── vite.config.ts     # Vite 构建配置
```

## 🤝 贡献 (Contributing)

欢迎提交 Issue 报告 Bug 或提交 Pull Request 来改进这个项目！

## 📄 开源协议 (License)

MIT License
