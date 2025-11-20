export const APP_MODE =
  process.env.NEXT_PUBLIC_APP_MODE || process.env.APP_MODE || "prod"

export const IS_TEST_MODE = APP_MODE === "test"
