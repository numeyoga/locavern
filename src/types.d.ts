export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export type AllowedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export type ActiveView = 'tasks' | 'projects' | 'notes';

export type TaskDisplayMode = 'list' | 'kanban';

export interface RichTextMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

export interface RichTextNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly text?: string;
  readonly marks?: readonly RichTextMark[];
  readonly content?: readonly RichTextNode[];
}

export interface RichTextDoc {
  readonly type: 'doc';
  readonly content?: readonly RichTextNode[];
}

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: string | null;
  readonly position: number;
  readonly descriptionDoc: RichTextDoc;
  readonly checklist: readonly ChecklistItem[];
  readonly assetIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Note {
  readonly id: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly contentDoc: RichTextDoc;
  readonly assetIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetMeta {
  readonly id: string;
  readonly mimeType: AllowedImageMimeType;
  readonly sizeBytes: number;
  readonly filename: string;
  readonly createdAt: string;
}

export interface AppPreferences {
  readonly activeView: ActiveView;
  readonly taskDisplayMode: TaskDisplayMode;
  readonly selectedProjectId: string | null;
  readonly selectedNoteId: string | null;
}

export interface AppState {
  readonly schemaVersion: 1;
  readonly readOnly: boolean;
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly assets: readonly AssetMeta[];
  readonly preferences: AppPreferences;
}

export interface HydratePayload {
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly assets: readonly AssetMeta[];
  readonly preferences?: Partial<AppPreferences>;
  readonly readOnly?: boolean;
}

export interface BackupData {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly assets: readonly AssetMeta[];
}

export interface BackupManifest {
  readonly format: 'locavern-archive';
  readonly schemaVersion: 1;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly counts: {
    readonly projects: number;
    readonly tasks: number;
    readonly notes: number;
    readonly assets: number;
  };
}

export type AppCommand =
  | { readonly type: 'hydrate'; readonly payload: HydratePayload }
  | { readonly type: 'set_read_only'; readonly readOnly: boolean }
  | { readonly type: 'set_view'; readonly view: ActiveView }
  | { readonly type: 'set_task_display_mode'; readonly mode: TaskDisplayMode }
  | { readonly type: 'select_project'; readonly projectId: string | null }
  | { readonly type: 'select_note'; readonly noteId: string | null }
  | {
      readonly type: 'create_project';
      readonly id: string;
      readonly name: string;
      readonly description?: string;
      readonly now: string;
    }
  | {
      readonly type: 'update_project';
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly now: string;
    }
  | {
      readonly type: 'toggle_archive_project';
      readonly id: string;
      readonly archived: boolean;
      readonly now: string;
    }
  | { readonly type: 'delete_project'; readonly id: string }
  | {
      readonly type: 'create_task';
      readonly id: string;
      readonly projectId: string;
      readonly title: string;
      readonly status?: TaskStatus;
      readonly priority?: TaskPriority;
      readonly dueDate?: string | null;
      readonly descriptionDoc?: RichTextDoc;
      readonly checklist?: readonly ChecklistItem[];
      readonly assetIds?: readonly string[];
      readonly now: string;
    }
  | {
      readonly type: 'update_task';
      readonly id: string;
      readonly patch: {
        readonly title?: string;
        readonly projectId?: string;
        readonly status?: TaskStatus;
        readonly priority?: TaskPriority;
        readonly dueDate?: string | null;
        readonly descriptionDoc?: RichTextDoc;
        readonly checklist?: readonly ChecklistItem[];
        readonly assetIds?: readonly string[];
      };
      readonly now: string;
    }
  | {
      readonly type: 'move_task';
      readonly id: string;
      readonly targetStatus: TaskStatus;
      readonly targetIndex: number;
      readonly now: string;
    }
  | { readonly type: 'delete_task'; readonly id: string }
  | {
      readonly type: 'create_note';
      readonly id: string;
      readonly projectId: string | null;
      readonly title: string;
      readonly contentDoc?: RichTextDoc;
      readonly assetIds?: readonly string[];
      readonly now: string;
    }
  | {
      readonly type: 'update_note';
      readonly id: string;
      readonly patch: {
        readonly projectId?: string | null;
        readonly title?: string;
        readonly contentDoc?: RichTextDoc;
        readonly assetIds?: readonly string[];
      };
      readonly now: string;
    }
  | { readonly type: 'delete_note'; readonly id: string }
  | { readonly type: 'register_asset'; readonly asset: AssetMeta }
  | { readonly type: 'delete_asset'; readonly id: string }
  | {
      readonly type: 'replace_all';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly assets: readonly AssetMeta[];
      };
    };

export type StoreEffect =
  | { readonly type: 'persist_project'; readonly project: Project }
  | {
      readonly type: 'remove_project';
      readonly id: string;
      readonly deletedTaskIds: readonly string[];
      readonly updatedNotes: readonly Note[];
    }
  | { readonly type: 'persist_task'; readonly task: Task }
  | { readonly type: 'persist_tasks'; readonly tasks: readonly Task[] }
  | { readonly type: 'remove_task'; readonly id: string }
  | { readonly type: 'persist_note'; readonly note: Note }
  | { readonly type: 'remove_note'; readonly id: string }
  | { readonly type: 'persist_asset_meta'; readonly asset: AssetMeta }
  | { readonly type: 'remove_asset'; readonly id: string }
  | { readonly type: 'persist_preferences'; readonly preferences: AppPreferences }
  | {
      readonly type: 'persist_replace_all';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly assets: readonly AssetMeta[];
      };
    };
