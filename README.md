## Joker

Joker is a framework platform engineered to support all development scenarios. Within its ecosystem, Joker.front stands as a front-end development framework. It delivers standardized front-end development protocols and employs an object-oriented, component-based programming model to facilitate efficient user interface development. Whether handling simple or complex interfaces, Joker.front operates with seamless proficiency.

<p align="center"><a href="https://jokers.pub" target="_blank" rel="noopener noreferrer"><img width="100" src="https://static.jokers.pub/joker.png" alt="Vue logo"></a></p>

<p align="center">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/%40joker.front%2Fcore">
    <img alt="NPM Downloads" src="https://img.shields.io/npm/d18m/%40joker.front%2Fcore">
    <img alt="NPM License" src="https://img.shields.io/npm/l/%40joker.front%2Fcore">
</p>

### What is Joker?

Joker is a versatile framework platform built on TypeScript, designed to cater to diverse development needs—from basic interface tasks to complex user interface challenges. It ensures exceptional performance and stability across all use cases. As a key part of this ecosystem, Joker.front serves as a front-end development framework, offering standardized specifications and leveraging object-oriented, component-based programming to streamline efficient UI construction, handling both simple and complex interfaces with ease.

Key features include:

-   **Robust Scalability**: Joker provides a component-based framework with scalability as a foundational design principle. It integrates seamlessly into existing projects or systems, supports the construction of scalable web applications, and allows for customization based on project requirements.
-   **Comprehensive Component Library**: Joker.front offers a full suite of front-end components, including meticulously designed and optimized functional and UI elements such as routing and scaffolding. These components enable developers to quickly build visually appealing, high-performance user interfaces.
-   **Complete Development Toolchain**: To enhance development efficiency, Joker includes a range of supporting tools—such as debugging and build tools—designed to streamline the development process, enabling accurate and rapid coding, building, testing, and updating.
-   **Class API**: Joker adopts TypeScript as the standard for script development and employs a standard Class API, aligning with object-oriented development requirements.
-   **Responsiveness**: Joker automatically tracks JavaScript states and updates the DOM reactively in real time when states change.
-   **High Performance**: It achieves point-to-point data synchronization for data and DOM updates, eliminating the need for DOM difference comparison and delivering a high-performance experience with instant update rendering.
-   **Official Visual Development IDE**: Joker comes with its own official visual development IDE, which enables rapid development, allowing developers to build interfaces and implement functions more efficiently through visual operations.

### Performance

Joker utilizes specialized rendering logic to map the association between responsive data and the DOM. This enables point-to-point node updates when data changes, bypassing full virtual node redraws and binary tree comparisons—significantly boosting rendering performance.

![](https://front.jokers.pub/base/render.png)

![](https://front.jokers.pub/base/ast-element.png)

[Detailed Explanation](https://front.jokers.pub/base/render)

### How to Use

The Joker CLI facilitates project creation, application and library code generation, and continuous development tasks such as testing, packaging, and deployment.

[Help Documentation](https://front.jokers.pub)

To install the Joker CLI, open a terminal/console and execute:

```
pnpm i -g @joker.front/cli
```

1. Run the CLI command `joker create` with the project name `my-app`:

```
joker create my-app
```

2. Navigate to the `my-app` directory and install dependencies:

```
cd my-app

pnpm i
```

The CLI will generate a new workspace and a simple welcome application, ready for immediate use.

### Running the Application

The Joker CLI includes server and build commands. The server command simplifies local application building and service provisioning.

Two default commands are provided: `dev` (development environment) and `build` (code building).

1. Navigate to the workspace folder (e.g., `my-app`):

```
cd my-app
```

2. Execute the following command:

```
npm run dev
```

Upon successful execution, a sample page will be displayed.

### Visual Development Tools

A front-end framework with built-in visual tools: [Visual Coding IDE](https://jokers.pub)

![Joker Visual Coding IDE](https://static.jokers.pub/home/component.png)
![Joker Visual Coding IDE](https://static.jokers.pub/home/workflow.png)
![Joker Visual Coding IDE](https://static.jokers.pub/home/validate.jpg)
![Joker Visual Coding IDE](https://static.jokers.pub/home/ai.png)

### Documentation

[Help Documentation](https://front.jokers.pub)

### Related Projects

[Official Website](https://front.jokers.pub)

[Official UI Library](https://ui.jokers.pub)

[Joker Visual Coding IDE](https://viscode.jokers.pub)
