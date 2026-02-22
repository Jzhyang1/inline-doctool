import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const bookmarkRegex = /<!--doc\s+(\S+?)\s+-->/;
const ghostRegex = /<!--inline\s+(\S+?)\s+-->/;

export function activate(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerCompletionItemProvider(
    [
      { scheme: "file", language: "python" },
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "typescript" },
    ],
    {
      provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position.line).text;
        const match = line.match(bookmarkRegex);

        if (!match) return [];

        const fileName = match[1].trim();
        const baseDir = path.dirname(document.uri.fsPath);
        const fullPath = path.resolve(baseDir, fileName);

        try {
          if (!fs.existsSync(fullPath)) return [];
          const content = fs.readFileSync(fullPath, "utf8");

          return [
            {
              label: `Inline ${path.basename(fileName)}`,
              insertText: content,
              documentation: `Inserts content from ${fileName}`,
              kind: vscode.CompletionItemKind.File,
              detail: content,
            },
          ];
        } catch (error) {
          return [];
        }
      },
    },
    ">",
  );

  // Ghost text provider using inline completions
  const inlineHintsProvider = vscode.languages.registerInlayHintsProvider(
    [
      { scheme: "file", language: "python" },
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "typescript" },
    ],
    {
      provideInlayHints(document, range, token) {
        const hints: vscode.InlayHint[] = [];

        for (let i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i).text;
          const match = line.match(ghostRegex);

          if (!match) continue;

          const fileName = match[1].trim();
          const baseDir = path.dirname(document.uri.fsPath);
          const fullPath = path.resolve(baseDir, fileName);

          try {
            if (!fs.existsSync(fullPath)) continue;
            const content = fs.readFileSync(fullPath, "utf8");

            // Position hint at end of comment line
            const endOfComment = line.indexOf("-->");
            if (endOfComment === -1) continue;

            const position = new vscode.Position(i, endOfComment);
            const hint = new vscode.InlayHint(position, content);
            hint.paddingLeft = true;
            hints.push(hint);
          } catch (error) {
            continue;
          }
        }

        return hints;
      },
    },
  );

  // Auto-trigger suggestions
  const selectionListener = vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      const currentLine = event.selections[0].active.line;
      const line = event.textEditor.document.lineAt(currentLine).text;

      // Check current line
      if (bookmarkRegex.test(line)) {
        vscode.commands.executeCommand("editor.action.triggerSuggest");
      }
    },
  );

  context.subscriptions.push(provider, inlineHintsProvider, selectionListener);
}

export function deactivate() {}
