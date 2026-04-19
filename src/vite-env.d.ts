/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * FILE: src/vite-env.d.ts
 *
 * PURPOSE
 * - TypeScript environment declarations for Vite.
 * - Adds compile-time type support for Vite-provided modules, including
 *   the PWA virtual registration module used in src/main.tsx.
 *
 * IMPORTANT
 * - This file is COMPILE-TIME ONLY.
 * - It is NOT imported anywhere.
 * - It is NOT executed in the browser.
 * - The triple-slash lines above are deliberate TypeScript reference
 *   directives, not commented-out dead code.
 *
 * WHY THIS EXISTS
 * - src/main.tsx imports:
 *     "virtual:pwa-register"
 * - That module is provided by vite-plugin-pwa at build time.
 * - Without this declaration file, TypeScript cannot resolve that module
 *   and the build fails with:
 *     Cannot find module 'virtual:pwa-register'
 *
 * LOCKED RULE
 * - Keep this file minimal.
 * - Do not add runtime code here.
 * - Do not convert this into a normal .ts file.
 */