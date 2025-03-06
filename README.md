# Joker ![npm](https://img.shields.io/npm/v/%40joker.front%2Fcore)![NPM Downloads](https://img.shields.io/npm/dw/%40joker.front%2Fcore)

Joker is a framework platform designed to provide support for all development scenarios. Among them, Joker.front is a front-end development framework under the Joker platform. It provides standardized front-end development standards, adopts an object-oriented and component-based programming model to help you develop user interfaces efficiently. Whether it's a simple or complex interface, Joker.front can handle it with ease.

## What is Joker?

Joker is a framework platform committed to providing support for all development scenarios. Joker.front, as a part of the Joker platform, is a front-end development framework. It provides standardized front-end development specifications and uses object-oriented and component-based programming methods to assist in efficiently building user interfaces. Whether the interface is simple or complex, Joker.front can handle it smoothly.

Joker is an all-purpose development platform built on TypeScript. Whether dealing with simple interface development requirements or handling complex user interface tasks, it demonstrates excellent performance and stability. It has the following important features:

-   **Powerful Scalability**: Joker provides a component-based framework. It has considered scalability from the beginning of its design, so it can be easily integrated into existing projects or systems, support the construction of scalable web applications, and can be customized according to project requirements.
-   **Rich Component Library**: Joker.front provides a complete set of front-end component libraries, including carefully designed and optimized functional and UI components such as routing and scaffolding, which can help developers quickly build beautiful and high-performance user interfaces.
-   **Complete Development Tools**: To further improve development efficiency, Joker also provides a series of supporting development tools, including debugging tools, building tools, etc. These carefully designed tools are aimed at making the development process smoother and helping developers develop, build, test, and update code accurately and quickly.
-   **Class API**: Joker uses TypeScript as the script development standard and adopts the standard Class API as the development specification, which is more in line with the requirements of object-oriented development.
-   **Responsiveness**: Joker will automatically track the JavaScript state, and can update the DOM in a responsive manner immediately when the state changes, and there is no difference comparison of the virtual DOM.

## Performance

Joker uses a special rendering logic to achieve the collection of the association relationship between responsive data and the DOM, and allows for point-to-point node changes when the data changes, avoiding the redrawing of the entire virtual node and the comparison process of the binary tree, greatly improving the rendering performance.

![](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/render.png)

![](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/ast-element.png)

[Detailed Explanation](https://front.jokers.pub/base/render)

## How to Use

You can use the Joker CLI to create projects, generate application and library code, and perform various continuous development tasks such as testing, packaging, and deployment.

[Help Documentation](https://front.jokers.pub)

To install the Joker CLI, open the terminal/console window and run the following command:

```
pnpm i -g @joker.front/cli
```

1. Run the CLI command **joker create** and provide the name my-app as a parameter, as follows:

```
joker create my-app
```

2. In the my-app working directory, install the dependencies.

```
cd my-app

pnpm i
```

The CLI will create a new workspace and a simple welcome application, which you can run at any time.

## Running the Application

The Joker CLI includes a server command and a build command. The server command is convenient for you to build and provide application services locally.

We provide two default commands, `dev` and `build`, representing the development environment and code building respectively.

1. Navigate to the workspace folder, such as my-app.

```
cd my-app
```

2. Run the following command:

```
npm run dev
```

After running successfully, a simple sample page will be displayed.

## Visual Development Tools

A front-end framework with built-in visual tools: [Low-code Platform](https://lowcode.jokers.pub)

![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img4.png)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img2.png)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img1.jpg)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img3.jpg)

## Documentation

[Help Documentation](https://front.jokers.pub)

[Official Website](https://front.jokers.pub)

[Official UI Library](https://ui.jokers.pub)

[Low-code Platform](https://jokers.pub)

## Wechat

![Wechat](https://static.jokers.pub/lowcode/wechat-group.jpg)

# Joker

Joker 是一个旨在为所有开发场景提供支持的框架平台。其中，Joker.front 是 Joker 平台下的前端开发框架，它提供标准化的前端开发标准，采用面向对象、组件化的编程模型，助力您高效开发用户界面。无论是简单还是复杂的界面，Joker.front 都能轻松应对。

## 什么是 Joker？

Joker 是一个致力于为所有开发场景提供支持的框架平台。其中，Joker.front 作为 Joker 平台的一部分，是一个前端开发框架。它提供标准化的前端开发规范，并运用面向对象和组件化的编程方式来协助高效构建用户界面。不管界面是简单还是复杂，Joker.front 都能顺利处理。

Joker 是一个基于 TypeScript 构建的全能开发平台。无论是应对简单的界面开发需求，还是处理复杂的用户界面任务，它都展现出卓越的性能与稳定性。它具备以下重要特性：

-   **强大的可扩展性**：Joker 提供基于组件的框架。其在设计之初就考虑到了扩展性，因此能够轻松集成到现有项目或系统中，支持构建可伸缩的 Web 应用，可根据项目需求进行定制化开发。
-   **丰富的组件库**：Joker.front 提供了一套完备的前端组件库，包括路由、脚手架等经过精心设计与优化的功能和 UI 组件，能够帮助开发者快速构建出美观且高性能的用户界面。
-   **完善的开发工具**：为进一步提升开发效率，Joker 还提供了一系列配套的开发工具，包括调试工具、构建工具等。这些精心设计的工具旨在让开发流程更加顺畅，助力开发者准确快速地开发、构建、测试以及更新代码。
-   **Class API**：Joker 以 TypeScript 作为脚本开发标准，并采用标准的 Class API 作为开发规范，更契合面向对象开发的要求。
-   **响应性**：Joker 会自动追踪 JavaScript 状态，当其发生变化时能即时响应式地更新 DOM，且不存在虚拟 DOM 的差异对比。

## 性能

Joker 采用的特殊的渲染逻辑，实现了响应式数据于 DOM 的关联关系收集，并允许在数据变更时实现点对点的节点变更，而避免了对整个虚拟节点的重绘和二叉树的对比过程，极大的实现了渲染性能。

![](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/render.png)

![](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/ast-element.png)

[详细说明](https://front.jokers.pub/base/render)

## 如何使用

您可以使用 Joker CLI 来创建项目、生成应用和库代码，以及执行各类持续开发任务，如测试、打包和部署。

[帮助文档](https://front.jokers.pub)

要安装 Joker CLI，请打开终端/控制台窗口，并运行如下命令：

```
pnpm i -g @joker.front/cli
```

1. 运行 CLI 命令 **joker create** 并提供 my-app 名称作为参数，如下所示：

```
joker create my-app
```

2. 在 my-app 工作目录下，安装依赖项。

```
cd my-app

pnpm i
```

CLI 将创建一个新的工作区以及一个简单的欢迎应用，您可以随时运行它。

## 运行应用

Joker CLI 包含一个服务器命令以及一个构建命令，服务器命令便于您在本地构建并提供应用服务。

我们默认提供了`dev`和`build`两个命令，分别代表开发环境和代码构建。

1. 导航至工作区文件夹，比如 my-app。

```
cd my-app
```

2. 运行以下命令：

```
npm run dev
```

成功运行后，将会显示一个简单的示例页面。

## 可视化开发工具

一个自带可视化工具的前端框架：[低代码平台](https://lowcode.jokers.pub)

![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img4.png)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img2.png)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img1.jpg)
![Joker Platform](https://gitee.com/joker_pub/joker-front-core/raw/main/readme/img3.jpg)

## 文档

[帮助文档](https://front.jokers.pub)

[官网](https://front.jokers.pub)

[官方 UI 库](https://ui.jokers.pub)

[低代码平台](https://jokers.pub)

## Wechat

![Wechat](https://static.jokers.pub/lowcode/wechat-group.jpg)
