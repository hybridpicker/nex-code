const TOOL_ICONS: Record<string, string> = {
  read_file: "📄",
  write_file: "✏️",
  edit_file: "✏️",
  patch_file: "✏️",
  bash: "⚡",
  list_directory: "📁",
  glob: "🔍",
  grep: "🔍",
  search_files: "🔍",
  git: "🌿",
  web_fetch: "🌐",
  web_search: "🌐",
  default: "🔧",
};

export class ToolCard {
  element: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private summaryEl: HTMLSpanElement;
  private iconEl: HTMLSpanElement;

  constructor(toolName: string, args: Record<string, unknown>) {
    this.element = document.createElement("div");
    this.element.className = "tool-card running";

    const icon = TOOL_ICONS[toolName] ?? TOOL_ICONS["default"];
    const argPreview = getArgPreview(toolName, args);

    this.element.innerHTML = `
      <div class="tool-card-header">
        <span class="tool-card-icon">${icon}</span>
        <span class="tool-card-name">${toolName}</span>
        <span class="tool-card-summary"></span>
        <span class="tool-card-chevron">›</span>
      </div>
      <div class="tool-card-body">${JSON.stringify(args, null, 2)}</div>
    `;

    this.iconEl = this.element.querySelector(".tool-card-icon")!;
    this.summaryEl = this.element.querySelector(".tool-card-summary")!;
    this.bodyEl = this.element.querySelector(".tool-card-body")!;

    // Toggle expand on header click
    const header = this.element.querySelector(".tool-card-header")!;
    header.addEventListener("click", () => {
      this.element.classList.toggle("expanded");
    });
  }

  finish(summary: string, ok: boolean) {
    this.element.classList.remove("running");
    this.iconEl.style.animation = "";
    this.summaryEl.textContent = summary;
    this.summaryEl.className = "tool-card-summary " + (ok ? "ok" : "fail");

    if (!ok) {
      // Failed cards stay expanded
      this.element.classList.add("expanded");
    }
  }
}

function getArgPreview(
  toolName: string,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case "read_file":
    case "write_file":
    case "edit_file":
    case "list_directory":
      return String(args.path ?? "");
    case "bash":
      return String(args.command ?? "").substring(0, 60);
    case "grep":
    case "search_files":
      return String(args.pattern ?? "");
    case "web_fetch":
      return String(args.url ?? "").substring(0, 50);
    default:
      return "";
  }
}
