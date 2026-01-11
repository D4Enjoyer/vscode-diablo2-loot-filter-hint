const vscode = require("vscode");
const hintDataManager = require("./hintDataManager");

const DOCUMENT_SELECTOR = [hintDataManager.FILTER_TYPE_POD, hintDataManager.FILTER_TYPE_PD2];

/**
 * @param {any} document
 * @param {any} position
 * @returns {string}
 */
function getTextAtCursor(document, position) {
    const range = new vscode.Range(position, new vscode.Position(position.line, position.character + 1));
    return document.getText(range);
}

/**
 * @param {any} document
 * @param {any} position
 * @returns {string}
 */
function getTextBeforeCursor(document, position) {
    var start = new vscode.Position(position.line, 0);
    var range = new vscode.Range(start, position);
    return document.getText(range);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasTextComment(text = "") {
    return text.match(/\/\//);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInCondition(text = "") {
    return text.match(/^ItemDisplay\[[^\]]*$/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInAction(text = "") {
    return text.match(/^ItemDisplay\[[^\]]*\]:/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInAliasName(text = "") {
    return text.match(/^Alias\[[^\]]*$/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInAliasContent(text = "") {
    return text.match(/^Alias\[[^\]]*\]:/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextAtLineStart(text = "") {
    // Match empty line, or line with only a partial word (no '[' yet means not inside condition/action)
    return text.match(/^\s*$/) || text.match(/^\s*[A-Za-z]+$/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextPossibleKeyword(text = "") {
    return text.match(/^[A-Z0-9_-]+$/);
}

/**
 * @param {any} document
 * @param {string} aliasName
 * @returns {string | null}
 */
function getAliasValue(document, aliasName) {
    if (!aliasName) return null;
    const text = document.getText();
    const escapedName = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^Alias\\[${escapedName}\\]:\\s*(.*)$`, 'm');
    const match = text.match(regex);
    if (match) {
        let value = match[1];
        const commentIndex = value.indexOf('//');
        if (commentIndex !== -1) {
            value = value.substring(0, commentIndex);
        }
        return value.trim();
    }
    return null;
}

function activate(context) {
    let subscriptions = context.subscriptions;
    let disposable = [];

    // completion provider
    disposable[0] = vscode.languages.registerCompletionItemProvider(DOCUMENT_SELECTOR, {
        provideCompletionItems: (document, position) => {
            const textBeforeCursor = getTextBeforeCursor(document, position);
            if (hasTextComment(textBeforeCursor)) {
                return null;
            }

            hintDataManager.init(document.languageId);

            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);

            if (isTextInCondition(textBeforeCursor)) {
                return isTextPossibleKeyword(word)
                    ? hintDataManager.getCompletionConditionKeywords()
                    : hintDataManager.getCompletionItems();
            }

            if (isTextInAction(textBeforeCursor)) {
                return isTextPossibleKeyword(word) ? hintDataManager.getCompletionActionKeywords() : null;
            }

            // Alias name (inside brackets) - no completions, it's just a string identifier
            if (isTextInAliasName(textBeforeCursor)) {
                return null;
            }

            // Alias content (after colon) - can be conditions OR actions
            if (isTextInAliasContent(textBeforeCursor)) {
                return isTextPossibleKeyword(word) ? hintDataManager.getCompletionAllKeywords() : hintDataManager.getCompletionItems();
            }

            if (isTextAtLineStart(textBeforeCursor)) {
                return hintDataManager.getCompletionLineTypes();
            }

            return null;
        },
    });

    // hover provider
    disposable[1] = vscode.languages.registerHoverProvider(DOCUMENT_SELECTOR, {
        provideHover: (document, position) => {
            // ignore non-alphanumeric character
            const char = getTextAtCursor(document, position);
            if (!char.match(/\w/)) {
                return null;
            }
            const textBeforeCursor = getTextBeforeCursor(document, position);
            if (hasTextComment(textBeforeCursor)) {
                return null;
            }

            hintDataManager.init(document.languageId);

            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);

            let hover = null;
            if (isTextInCondition(textBeforeCursor)) {
                hover = hintDataManager.getConditionHoverItem(word);
            }

            if (isTextInAction(textBeforeCursor)) {
                hover = hintDataManager.getActionHoverItem(word);
            }

            // Alias content can be either conditions or actions
            if (isTextInAliasContent(textBeforeCursor)) {
                hover = hintDataManager.getConditionHoverItem(word) || hintDataManager.getActionHoverItem(word);
            }

            if (!hover) {
                const aliasValue = getAliasValue(document, word);
                if (aliasValue) {
                    hover = new vscode.Hover(aliasValue); 
                }
            }

            // return clone to avoid positioning bug
            return hover ? { ...hover } : null;
        },
    });

    subscriptions.push(...disposable);
}

function deactivate() {}

exports.activate = activate;
exports.deactivate = deactivate;
