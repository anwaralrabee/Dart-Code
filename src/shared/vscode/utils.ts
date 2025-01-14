import { env as vsEnv, ExtensionKind, extensions, Position, Range, Selection, TextDocument, TextEditor, TextEditorRevealType, Uri, workspace, WorkspaceFolder } from "vscode";
import { dartCodeExtensionIdentifier } from "../constants";
import { Location } from "../interfaces";
import { forceWindowsDriveLetterToUppercase } from "../utils";

const dartExtension = extensions.getExtension(dartCodeExtensionIdentifier);
// The extension kind is declared as Workspace, but VS Code will return UI in the
// case that there is no remote extension host.
export const isRunningLocally = !dartExtension || dartExtension.extensionKind === ExtensionKind.UI;

export function fsPath(uri: Uri | string) {
	// tslint:disable-next-line:disallow-fspath
	return forceWindowsDriveLetterToUppercase(uri instanceof Uri ? uri.fsPath : uri);
}

export function getDartWorkspaceFolders(): WorkspaceFolder[] {
	if (!workspace.workspaceFolders)
		return [];
	return workspace.workspaceFolders.filter(isDartWorkspaceFolder);
}

export function isDartWorkspaceFolder(folder?: WorkspaceFolder): boolean {
	if (!folder || folder.uri.scheme !== "file")
		return false;

	// Currently we don't have good logic to know what's a Dart folder.
	// We could require a pubspec, but it's valid to just write scripts without them.
	// For now, nothing calls this that will do bad things if the folder isn't a Dart
	// project so we can review amend this in future if required.
	return true;
}

export function toRange(document: TextDocument, offset: number, length: number): Range {
	return new Range(document.positionAt(offset), document.positionAt(offset + length));
}

export function toPosition(location: Location): Position {
	return new Position(location.startLine - 1, location.startColumn - 1);
}

// Translates an offset/length to a Range.
// NOTE: Does not wrap lines because it does not have access to a TextDocument to know
// where the line ends.
export function toRangeOnLine(location: Location): Range {
	const startPos = toPosition(location);
	return new Range(startPos, startPos.translate(0, location.length));
}

export function showCode(editor: TextEditor, displayRange: Range, highlightRange: Range, selectionRange?: Range): void {
	if (selectionRange)
		editor.selection = new Selection(selectionRange.start, selectionRange.end);

	// Ensure the code is visible on screen.
	editor.revealRange(displayRange, TextEditorRevealType.InCenterIfOutsideViewport);

	// TODO: Implement highlighting
	// See https://github.com/Microsoft/vscode/issues/45059
}

class EnvUtils {
	public async openInBrowser(url: string): Promise<boolean> {
		return vsEnv.openExternal(Uri.parse(url));
	}

	public async asExternalUri(uri: Uri): Promise<Uri> {
		// TODO: Remove this scheme mapping when https://github.com/microsoft/vscode/issues/84819
		// is resolved.
		const fakeScheme = uri.scheme === "ws" ? "http" : "https";
		const mappedUri = await vsEnv.asExternalUri(uri.with({ scheme: fakeScheme }));

		// Now we need to map the scheme back to WS if that's what was originally asked for, however
		// we need to take into account whether asExternalUri pushed is up to secure, so use
		// the http/https to decide which to go back to.
		let newScheme = mappedUri.scheme;
		if (uri.scheme === "ws" || uri.scheme === "wss")
			newScheme = mappedUri.scheme === "https" ? "wss" : "ws";

		return mappedUri.with({ scheme: newScheme });
	}
}

export const envUtils = new EnvUtils();
