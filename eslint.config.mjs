import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**"] },
  {
    files: ["app/components/smart-commerce-pilot.tsx", "app/api/call-center/tools/execute/route.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
];
