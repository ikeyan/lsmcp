/**
 * Workspace edit management
 */

import { fileURLToPath } from "url";
import type { WorkspaceEdit } from "../protocol/types/index.ts";
import type { ApplyWorkspaceEditResponse } from "../protocol/types/responses.ts";
import type { IFileSystem } from "../interfaces.ts";
import { applyTextEdits } from "../utils/textEdits.ts";
import type { DocumentManager } from "./document-manager.ts";

function toPath(uri: string): string {
  return uri.startsWith("file://") ? fileURLToPath(uri) : uri;
}

/** Apply `edit.changes` to the files on disk; failure is reported in the result, not thrown. */
export async function applyWorkspaceEdit(
  edit: WorkspaceEdit,
  fileSystemApi: IFileSystem,
): Promise<ApplyWorkspaceEditResponse> {
  if ("documentChanges" in edit && edit.documentChanges !== undefined) {
    return {
      applied: false,
      failureReason: "documentChanges is not supported",
    };
  }
  try {
    for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
      if (!edits || edits.length === 0) {
        continue;
      }
      const filePath = toPath(uri);
      const currentContent = await fileSystemApi.readFile(filePath);
      await fileSystemApi.writeFile(
        filePath,
        applyTextEdits(currentContent, edits),
      );
    }
    return { applied: true };
  } catch (err) {
    return {
      applied: false,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Handle a server's workspace/applyEdit: apply it, then resend the new
 * content of every changed document that is open so the server's copy
 * matches the file before it receives the response.
 */
export async function applyEditFromServer(
  edit: WorkspaceEdit,
  fileSystemApi: IFileSystem,
  documentManager: DocumentManager,
  sendNotification: (method: string, params: unknown) => void,
): Promise<ApplyWorkspaceEditResponse> {
  const result = await applyWorkspaceEdit(edit, fileSystemApi);
  if (!result.applied) {
    return result;
  }
  for (const uri of Object.keys(edit.changes ?? {})) {
    if (documentManager.isDocumentOpen(uri)) {
      const content = await fileSystemApi.readFile(toPath(uri));
      documentManager.updateDocument(uri, content, sendNotification);
    }
  }
  return result;
}
