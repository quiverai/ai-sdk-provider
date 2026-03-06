declare const __PACKAGE_VERSION__: string | undefined;

export const VERSION =
  typeof __PACKAGE_VERSION__ !== "undefined"
    ? __PACKAGE_VERSION__
    : "0.0.0-test";
