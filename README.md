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
