import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	Range,
	integer
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { ExecException } from 'child_process';
import { exec } from 'node:child_process';
import path = require('path');
import { fileURLToPath } from 'url';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	yayalint_path: string;
	yaya_cfg: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { yayalint_path: "", yaya_cfg: "" };
let globalSettings: ExampleSettings = defaultSettings;

const isOpened: Map<string,boolean> = new Map<string, boolean>();

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.yayalint || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'yayalint'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
	isOpened.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	if (! isOpened.get(change.document.uri)) {
		isOpened.set(change.document.uri, true);
		validateTextDocument(change.document);
	}
});

documents.onDidSave(change =>{
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	if (settings.yayalint_path.length == 0) {
		connection.window.showInformationMessage('yayalint_path is not configured.');
		return;
	}
	if (settings.yaya_cfg.length == 0) {
		connection.window.showInformationMessage('yaya_cfg is not configured.');
		return;
	}
	//const yaya_cfg as string from settings.yaya_cfg, if it's relative path, completes it based on the workspace path.
	//workspace path: vscode.workspace.workspaceFolders[0].uri.path
	connection.workspace.getWorkspaceFolders().then(folders => {
		if (!folders || folders.length == 0) {
			return;
		}
		const yaya_cfg	= path.resolve(fileURLToPath(folders[0].uri), settings.yaya_cfg);
		connection.window.showInformationMessage('Starting yayalint: "' + settings.yayalint_path + '" "' + yaya_cfg + '"');
		exec(`"${settings.yayalint_path}" "${yaya_cfg}"`, (error : ExecException | null, stdout : string, stderr : string) => {
			if (error) {
				// TODO error
				connection.window.showErrorMessage(error.message);
				return;
			}
			if (stderr.length > 0) {
				connection.window.showErrorMessage(stderr);
				return;
			}
			const diagnostics : Diagnostic[] = [];
			for (const l of stdout.split(/(?:\r\n|\r|\n)/)) {
				const data  = l.split(/\t/);
				const message : string = data[0];
				if (message === 'read undefined variable:' || message === 'read undefined function:' || message === 'unused variable:' || message === 'unused function:') {
					const varname : string = data[1];
					const filename : string = data[3];
					const position : string[] = data[5].split(/:/);
					const line : integer = parseInt(position[0]);
					const col : integer = parseInt(position[1]);
					const base : string = path.dirname(yaya_cfg);
					const p : string = path.normalize(path.join(base, filename));
					if (path.relative(fileURLToPath(textDocument.uri), p).length == 0) {
						let severity : DiagnosticSeverity = DiagnosticSeverity.Warning;
						if (message === 'unused variable:' || message === 'unused function:') {
							severity = DiagnosticSeverity.Information;
						}
						const range : Range = { start: { line: line - 1, character: col - 1 },
						end: { line: line - 1, character: col + varname.length - 1 } };
						const diagnostic: Diagnostic = {
							severity: severity,
							range: range,
							message: `${message} ${varname}`,
							source: 'yayalint'
						};
						diagnostics.push(diagnostic);
					}
				}
			}
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
			connection.window.showInformationMessage('Completed yayalint');
		});
	})
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
