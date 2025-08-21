import eslint from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { globalIgnores } from "eslint/config"

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    // tseslint.configs.strict,
    globalIgnores(["src/indexedDB/w3c-tests", "lib"]),
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: globals.browser,
        },
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    },
)
