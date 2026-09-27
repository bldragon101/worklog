import path from "path";

export const STORAGE_STATE = path.resolve(
  __dirname,
  "../.auth/user.json",
);

export const NON_ADMIN_STORAGE_STATE = path.resolve(
  __dirname,
  "../.auth/non-admin.json",
);
