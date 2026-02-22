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
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const bookmarkRegex = /<!--doc\s+(\S+?)\s+-->/;
const ghostRegex = /<!--inline\s+(\S+?)\s+-->/;
function activate(context) {
    const provider = vscode.languages.registerCompletionItemProvider([
        { scheme: "file", language: "python" },
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "typescript" },
    ], {
        provideCompletionItems(document, position, token, context) {
            const line = document.lineAt(position.line).text;
            const match = line.match(bookmarkRegex);
            if (!match)
                return [];
            const fileName = match[1].trim();
            const baseDir = path.dirname(document.uri.fsPath);
            const fullPath = path.resolve(baseDir, fileName);
            try {
                if (!fs.existsSync(fullPath))
                    return [];
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
            }
            catch (error) {
                return [];
            }
        },
    }, ">");
    // Ghost text provider using inline completions
    const inlineHintsProvider = vscode.languages.registerInlayHintsProvider([
        { scheme: "file", language: "python" },
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "typescript" },
    ], {
        provideInlayHints(document, range, token) {
            const hints = [];
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text;
                const match = line.match(ghostRegex);
                if (!match)
                    continue;
                const fileName = match[1].trim();
                const baseDir = path.dirname(document.uri.fsPath);
                const fullPath = path.resolve(baseDir, fileName);
                try {
                    if (!fs.existsSync(fullPath))
                        continue;
                    const content = fs.readFileSync(fullPath, "utf8");
                    // Position hint at end of comment line
                    const endOfComment = line.indexOf("-->");
                    if (endOfComment === -1)
                        continue;
                    const position = new vscode.Position(i, endOfComment);
                    const hint = new vscode.InlayHint(position, content);
                    hint.paddingLeft = true;
                    hints.push(hint);
                }
                catch (error) {
                    continue;
                }
            }
            return hints;
        },
    });
    // Auto-trigger suggestions
    const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
        const currentLine = event.selections[0].active.line;
        const line = event.textEditor.document.lineAt(currentLine).text;
        // Check current line
        if (bookmarkRegex.test(line)) {
            vscode.commands.executeCommand("editor.action.triggerSuggest");
        }
    });
    context.subscriptions.push(provider, inlineHintsProvider, selectionListener);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map