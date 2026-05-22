/// <reference types="vitest/globals" />

declare namespace vi {
  type Mock = import("vitest").Mock;
  type Mocked<T> = import("vitest").Mocked<T>;
  type MockedFunction<T extends (...args: any[]) => any> =
    import("vitest").MockedFunction<T>;
}
