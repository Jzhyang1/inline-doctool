import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const TRIGGER = "@idoc";
const REGEX = /@idoc ([^:]+):?(.+)?/;

export function activate(context: vscode.ExtensionContext) {
  // 2. Definition Provider: Links the "trigger" to the virtual document
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { scheme: "file" },
    {
      provideDefinition(document, position) {
        const line = document.lineAt(position.line);
        const match = line.text.match(REGEX);
        if (match) {
          const fileName = match[1].trim();
          const entryName = match[2]?.trim();

          let fullPath: string;
          if (fileName.startsWith("/")) {
            // From project root
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(
              document.uri,
            );
            if (!workspaceFolder) {
              vscode.window.showErrorMessage(
                "No workspace folder found. Cannot resolve path.",
              );
              return null;
            }

            fullPath = path.resolve(
              workspaceFolder.uri.fsPath,
              fileName.substring(1),
            );
          } else {
            // Relative to current file
            const baseDir = path.dirname(document.uri.fsPath);
            fullPath = path.resolve(baseDir, fileName);
          }

          const uri = vscode.Uri.file(fullPath);

          // `entryName` will be searched for in the file
          const content = fs.readFileSync(fullPath, "utf8");
          const entryLines = content.split("\n");
          let entryStartLine = 0;
          if (entryName) {
            for (let i = 0; i < entryLines.length; i++) {
              if (entryLines[i].includes(entryName)) {
                entryStartLine = i;
                break;
              }
            }
          }

          return new vscode.Location(
            uri,
            new vscode.Position(entryStartLine, 0),
          );
        }
        return null;
      },
    },
  );

  // 3. CodeLens: Makes it clickable without needing Ctrl+Click
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    {
      provideCodeLenses(document) {
        const lenses: vscode.CodeLens[] = [];
        for (let i = 0; i < document.lineCount; i++) {
          if (document.lineAt(i).text.includes(TRIGGER)) {
            lenses.push(
              new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
                title: "Peek JSON Data",
                command: "editor.action.peekDefinition", // Built-in VS Code command
              }),
            );
          }
        }
        return lenses;
      },
    },
  );

  context.subscriptions.push(definitionProvider, codeLensProvider);
}
