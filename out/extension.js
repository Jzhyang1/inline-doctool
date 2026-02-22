"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TRIGGER = "@idoc";
const REGEX = /@idoc ([^:]+):?(.+)?/;
function activate(context) {
    // 2. Definition Provider: Links the "trigger" to the virtual document
    const definitionProvider = vscode.languages.registerDefinitionProvider({ scheme: "file" }, {
        provideDefinition(document, position) {
            const line = document.lineAt(position.line);
            const match = line.text.match(REGEX);
            if (match) {
                const fileName = match[1].trim();
                const entryName = match[2]?.trim();
                let fullPath;
                if (fileName.startsWith("/")) {
                    // From project root
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("No workspace folder found. Cannot resolve path.");
                        return null;
                    }
                    fullPath = path.resolve(workspaceFolder.uri.fsPath, fileName.substring(1));
                }
                else {
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
                return new vscode.Location(uri, new vscode.Position(entryStartLine, 0));
            }
            return null;
        },
    });
    // 3. CodeLens: Makes it clickable without needing Ctrl+Click
    const codeLensProvider = vscode.languages.registerCodeLensProvider({ scheme: "file" }, {
        provideCodeLenses(document) {
            const lenses = [];
            for (let i = 0; i < document.lineCount; i++) {
                if (document.lineAt(i).text.includes(TRIGGER)) {
                    lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
                        title: "Peek JSON Data",
                        command: "editor.action.peekDefinition", // Built-in VS Code command
                    }));
                }
            }
            return lenses;
        },
    });
    context.subscriptions.push(definitionProvider, codeLensProvider);
}
//# sourceMappingURL=extension.js.map