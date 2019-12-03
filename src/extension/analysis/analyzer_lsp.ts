import * as path from "path";
import * as stream from "stream";
import { LanguageClient, LanguageClientOptions, StreamInfo } from "vscode-languageclient";
import { Analyzer } from "../../shared/analyzer";
import { dartVMPath } from "../../shared/constants";
import { DartSdks, Logger } from "../../shared/interfaces";
import { config } from "../config";
import { AnalyzerStatusNotification, DiagnosticServerRequest } from "../lsp/custom_protocol";
import { DartCapabilities } from "../sdk/capabilities";
import { safeSpawn } from "../utils/processes";
import { getAnalyzerArgs } from "./analyzer";

export class LspAnalyzer extends Analyzer {
	public readonly client: LanguageClient;
	public readonly onReady: Promise<void>;
	public readonly onInitialAnalysisComplete: Promise<void>;

	constructor(logger: Logger, sdks: DartSdks, dartCapabilities: DartCapabilities) {
		super();
		this.client = createClient(logger, sdks, dartCapabilities);
		this.disposables.push(this.client.start());

		this.onReady = this.client.onReady();
		this.onInitialAnalysisComplete = new Promise((resolve) => {
			this.onReady.then(() => {
				this.client.onNotification(AnalyzerStatusNotification.type, (params) => {
					resolve();
					this.onAnalysisStatusChangeEmitter.fire({ isAnalyzing: params.isAnalyzing });
				});
			});
		});
	}

	public async getDiagnosticServerPort(): Promise<{ port: number }> {
		return this.client.sendRequest(DiagnosticServerRequest.type, undefined);
	}
}

function createClient(logger: Logger, sdks: DartSdks, dartCapabilities: DartCapabilities): LanguageClient {
	const clientOptions: LanguageClientOptions = {
		initializationOptions: {
			// 	onlyAnalyzeProjectsWithOpenFiles: true,
			closingLabels: config.closingLabels,
		},
		outputChannelName: "LSP",
	};

	const client = new LanguageClient(
		"dartAnalysisLSP",
		"Dart Analysis Server",
		() => spawnServer(logger, sdks, dartCapabilities),
		clientOptions,
	);

	return client;
}

function spawnServer(logger: Logger, sdks: DartSdks, dartCapabilities: DartCapabilities): Thenable<StreamInfo> {
	// TODO: Replace with constructing an Analyzer that passes LSP flag (but still reads config
	// from paths etc) and provide it's process.
	const vmPath = path.join(sdks.dart, dartVMPath);
	const args = getAnalyzerArgs(logger, sdks, dartCapabilities, true);

	const process = safeSpawn(undefined, vmPath, args);
	// TODO: Set up logging for LSP.
	// logProcess(logger, LogCategory.Analyzer, process);

	if (true) {
		return Promise.resolve({ reader: process.stdout, writer: process.stdin });
	} else {
		// TODO: Run this through logger once the in-process logging changes
		const reader = process.stdout.pipe(new LoggingTransform("<=="));
		const writer = new LoggingTransform("==>");
		writer.pipe(process.stdin);

		return Promise.resolve({ reader, writer });
	}
}

class LoggingTransform extends stream.Transform {
	constructor(private prefix: string, opts?: stream.TransformOptions) {
		super(opts);
	}
	public _transform(chunk: any, encoding: string, callback: () => void): void {
		console.log(`${this.prefix} ${chunk}`);
		this.push(chunk, encoding);
		callback();
	}
}
