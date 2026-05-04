import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 排除独立集成测试（用 node xxx.test.cjs 手动运行，不通过 vitest）
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/investment.api.test.cjs",
      "**/budget.api.test.cjs",
    ],
    // 全局测试文件
    include: ["src/**/*.test.{ts,js}"],
  },
});
