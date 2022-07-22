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
const util	= require('node:util');
const exec	= util.promisify(require('node:child_process').exec);
import path = require('path');
import { fileURLToPath, pathToFileURL } from 'url';
import * as fs from 'fs';

function localizeTable() {
	const nls	= JSON.parse(process.env.VSCODE_NLS_CONFIG || "");
	const locale	= nls.locale || "generic";
	try {
		const data	= fs.readFileSync(path.join(__dirname, "..", "..", `package.nls.${locale.replace(/-.*/, '')}.json`));
		return JSON.parse(data.toString());
	}
	catch (error) {
		const data	= fs.readFileSync(path.join(__dirname, "..", "..", `package.nls.json`));
		return JSON.parse(data.toString());
	}
}

const localize_table = localizeTable();

function localize(key:string, fmt:string, ...args:any[]):string {
	const format:string	= localize_table[key] || fmt;
	return format.replace(/\{(\d+)\}/g, (_match, n, _offset, _string, _groups) => {
		return args[parseInt(n)];
	});
}

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
interface YayalintSettings {
	yayalint_path: string;
	yaya_cfg: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: YayalintSettings = { yayalint_path: "", yaya_cfg: "" };
let globalSettings: YayalintSettings = defaultSettings;

const isOpened: Map<string,boolean> = new Map<string, boolean>();
const analysisResult: Map<string, Diagnostic[]>	= new Map<string, Diagnostic[]>();
const once:Map<string, boolean> = new Map<string, boolean>();

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<YayalintSettings>> = new Map();

interface MessageInfo {
	resourceID:string,
	severity:DiagnosticSeverity,
}

async function analysis(str:string, base:string) {
	const message2info = new Map<string, MessageInfo>([
		["unused variable:", {resourceID: "yayalint.analysis.info.unused_variable", severity: DiagnosticSeverity.Information}],
		["unused function:", {resourceID: "yayalint.analysis.info.unused_function", severity: DiagnosticSeverity.Information}],
		["read undefined variable:", {resourceID: "yayalint.analysis.warning.undefined_variable", severity: DiagnosticSeverity.Warning}],
		["read undefined function:", {resourceID: "yayalint.analysis.warning.undefined_function", severity: DiagnosticSeverity.Warning}],
		["case statement contains a clause that is neither a when clause nor others clause:", {resourceID: "yayalint.analysis.warning.case_statement_contains_not_when_or_other", severity: DiagnosticSeverity.Warning}],
		["assignment operator exists in conditional statement:", {resourceID: "yayalint.analysis.warning.assign_in_conditional_statement", severity: DiagnosticSeverity.Warning}],
		["dic not found:", {resourceID: "yayalint.analysis.warning.dic_not_found", severity: DiagnosticSeverity.Warning}],
		["dicdir not found:", {resourceID: "yayalint.analysis.warning.dicdir_not_found", severity: DiagnosticSeverity.Warning}],
		["not found:", {resourceID: "yayalint.analysis.warning.dic_or_dicdir_not_found", severity: DiagnosticSeverity.Warning}],
		["syntax error:", {resourceID: "yayalint.analysis.error.syntax_error", severity: DiagnosticSeverity.Error}],
	]);
	/*
	const message2resourceID = new Map<string, string>([
		["unused variable:", "yayalint.analysis.info.unused_variable"],
		["unused function:", "yayalint.analysis.info.unused_function"],
		["read undefined variable:", "yayalint.analysis.warning.undefined_variable"],
		["read undefined function:", "yayalint.analysis.warning.undefined_function"],
		["case statement contains a clause that is neither a when clause nor others clause:", "yayalint.analysis.warning.case_statement_contains_not_when_or_other"],
		["assinment operator exists in conditional statement:", "yayalint.analysis.warning.assign_in_conditional_statement"],
		["dic not found:", "yayalint.analysis.warning.dic_not_found"],
		["dicdir not found:", "yayalint.analysis.warning.dicdir_not_found"],
		["not found:", "yayalint.analysis.warning.dic_or_dicdir_not_found"],
	]);
	const message2severity	= new Map<string, DiagnosticSeverity>([
		["unused variable:", DiagnosticSeverity.Information],
		["unused function:", DiagnosticSeverity.Information],
		["read undefined variable:", DiagnosticSeverity.Warning],
		["read undefined function:", DiagnosticSeverity.Warning],
		["case statement contains a clause that is neither a when clause nor others clause:", DiagnosticSeverity.Warning],
		["assinment operator exists in conditional statement:", DiagnosticSeverity.Warning],
		["dic not found:", DiagnosticSeverity.Warning],
		["dicdir not found:", DiagnosticSeverity.Warning],
		["not found:", DiagnosticSeverity.Warning],
	]);
	*/
	analysisResult.clear();
	let diagnostic_number = 0;
	for (const l of str.split(/(?:\r\n|\r|\n)/).filter(line => line.length > 0)) {
		const data  = l.split(/\t/);
		const message : string = data[0];
		if ( ! message2info.has(message)) {
			connection.window.showInformationMessage(localize("yayalint.analysis.error.invalid_format", "Invalid format line: {0}", l));
			continue;
		}
		const varname : string = data[1];
		const filename : string = data[3];
		const position : string[] = data[5].split(/:/);
		const line : integer = parseInt(position[0]);
		const col : integer = parseInt(position[1]);
		const p : string = path.normalize(path.join(base, filename));
		if (!analysisResult.has(p)) {
			analysisResult.set(p, []);
		}
		const diagnostics:Diagnostic[] | undefined	= analysisResult.get(p);
		if (diagnostics) {
			const info:MessageInfo	= message2info.get(message) || {resourceID: "yayalint.analysis.error.unreachable", severity: DiagnosticSeverity.Error};
			const severity : DiagnosticSeverity = info.severity;
			const range : Range = {
									start: 	{ line: line - 1, character: col - 1 },
									end: 	{ line: line - 1, character: col + varname.length - 1 }
									};
			const diagnostic: Diagnostic = {
				severity: severity,
				range: range,
				message: localize(info.resourceID, message + ' {0}', varname),
				source: 'yayalint'
			};
			diagnostics.push(diagnostic);
			diagnostic_number++;
		}
	}
	let info=localize('yayalint.analysis.complete', 'yayalint analysis finished with {0} hints for {1} files.', diagnostic_number.toString(), analysisResult.size.toString());
	connection.window.showInformationMessage(info);
}

async function update_yayalint_charge(settings:YayalintSettings): Promise<void> {
	if (settings.yayalint_path.length == 0) {
		//'yayalint_path is not configured'
		throw new Error(localize('yayalint.analysis.error.not_configured.yayalint_path', 'yayalint_path is not configured.'));
	}
	if (settings.yaya_cfg.length == 0) {
		//'yaya_cfg is not configured'
		throw new Error(localize('yayalint.analysis.error.not_configured.yaya_cfg', 'yaya_cfg is not configured.'));
	}
	const folders = await connection.workspace.getWorkspaceFolders();
	if (!folders || folders.length == 0) {
		//'no workspace folder'
		throw new Error(localize('yayalint.analysis.error.no_workspace_folder', 'No workspace folder found.'));
	}
	const yaya_cfg	= path.resolve(fileURLToPath(folders[0].uri), settings.yaya_cfg);
	{
		let header=localize('yayalint.analysis.message.charge_updateing.header', 'Updating yayalint charge:');
		connection.window.showInformationMessage(`${header} "${settings.yayalint_path}" "${yaya_cfg}"`);
	}
	const { stdout, stderr }	= await exec(`"${settings.yayalint_path}" "${yaya_cfg}"`);
	if (stderr && stderr.length > 0) {
		throw new Error(stderr);
	}
	if (stdout && stdout.length > 0) {
		await analysis(stdout, path.dirname(yaya_cfg));
	}
}

async function update_yayalint_charge_by_doc(textDocument:TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);
	await update_yayalint_charge(settings);
}


connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <YayalintSettings>(
			(change.settings.yayalint || defaultSettings)
		);
	}

	for (const document of documents.all()) {
		// Revalidate all open text documents
		update_yayalint_charge_by_doc(document).then(() => {
			documents.all().forEach(validateTextDocument);
		}).catch(error => {
			connection.window.showErrorMessage(error.message);
		});
		break;
	}
});

function getDocumentSettings(resource: string): Thenable<YayalintSettings> {
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
	if (!isOpened.get(change.document.uri)) {
		isOpened.set(change.document.uri, true);
	}
	const folders = connection.workspace.getWorkspaceFolders().then((folders) => {
		if (!folders || folders.length == 0) {
			return;
		}
		const uri	= folders[0].uri
		if (once.has(uri)) {
			documents.all().forEach(ClearDiagnostic);
			validateTextDocument();
		}
		else {
			once.set(uri, true);
			update_yayalint_charge_by_doc(change.document).then(() => {
				documents.all().forEach(ClearDiagnostic);
				validateTextDocument();
			}).catch(error => {
				connection.window.showErrorMessage(error.message);
			});
		}
	})
});

documents.onDidSave(change =>{
	update_yayalint_charge_by_doc(change.document).then(() => {
		documents.all().forEach(ClearDiagnostic);
		validateTextDocument();
	}).catch((error) => {
		connection.window.showErrorMessage(error.message);
	});
});

async function ClearDiagnostic(textDocument: TextDocument): Promise<void> {
	connection.sendDiagnostics({uri: textDocument.uri, diagnostics: []});
}

async function validateTextDocument(): Promise<void> {
	for (const p of analysisResult.keys()) {
		const diagnostics:Diagnostic[] | undefined	= analysisResult.get(p);
		if (diagnostics) {
			connection.sendDiagnostics({uri: pathToFileURL(p).toString(), diagnostics});
		}
	}
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
