import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: "locale",
      sourceLanguage: "en-US",
      // LINKED-DATA: the video "compare" (site/video/projects/compare/storyboard.yaml, scene llm-preview)
      // runs --llm-translate from the panel. The key never lands here: the pipeline hands
      // OPENROUTER_API_KEY to VS Code's terminals (vscode.env in the YAML).
      llm: {
        connection: {
          baseURL: "https://openrouter.ai/api/v1",
          model: "deepseek/deepseek-v4.1-flash",
          apiKeyEnv: "OPENROUTER_API_KEY",
          costMillionInput: 0.15, // OpenRouter, October 2026
          costMillionOutput: 0.6,
        },
        costGuard: 0.05, // a few keys cost far less: no question on camera
        context: { mode: "off" }, // one request, not two
      },
    }),
  ],
});
