import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: "locale",
      sourceLanguage: "en-US",
      // LINKED-DATA: the video "gif20" (site/video/projects/gif20/storyboard.yaml, scenes translate and french)
      // runs --llm-translate from the panel. The key never lands here: the pipeline hands
      // OPENROUTER_API_KEY to VS Code's terminals (vscode.env in the YAML).
      llm: {
        connection: {
          baseURL: "https://openrouter.ai/api/v1",
          model: "deepseek/deepseek-v4.1-flash",
          apiKeyEnv: "OPENROUTER_API_KEY",
          costMillionInput: 0.15, // OpenRouter, October 2026
          costMillionOutput: 0.6,
          // The model thinks by default (92% of its output, measured): switched off, the run is faster and the
          // terminal ends on the "Full translate!" line, with no warning under it (docs: llm/price, reasoning models).
          providerOptions: { reasoning: { enabled: false } },
        },
        costGuard: 0.05, // one key costs far less: no question on camera
        context: { mode: "off" }, // one request, not two
      },
    }),
  ],
});
