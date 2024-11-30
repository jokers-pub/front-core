module.exports = {
    testEnvironment: "jsdom",
    //选择的不同的处理器
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    // 是否搜集单测覆盖率信息。
    collectCoverage: false,
    moduleFileExtensions: ["ts", "js", "json"]
};
