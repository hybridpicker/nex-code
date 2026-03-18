export class ConfirmDialog {
  element: HTMLDivElement;

  constructor(
    question: string,
    tool: string,
    critical: boolean,
    onAnswer: (answer: boolean) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'confirm-card' + (critical ? ' critical' : '');
    this.element.innerHTML = `
      <div class="confirm-question">${escapeHtml(question)}</div>
      <div class="confirm-tool">Tool: ${escapeHtml(tool)}</div>
      <div class="confirm-buttons">
        <button class="confirm-btn yes">Yes</button>
        <button class="confirm-btn no">No</button>
      </div>
    `;

    const yesBtn = this.element.querySelector('.confirm-btn.yes')!;
    const noBtn = this.element.querySelector('.confirm-btn.no')!;

    yesBtn.addEventListener('click', () => {
      this.disable();
      onAnswer(true);
    });
    noBtn.addEventListener('click', () => {
      this.disable();
      onAnswer(false);
    });
  }

  private disable() {
    const btns = this.element.querySelectorAll('.confirm-btn');
    btns.forEach((b) => ((b as HTMLButtonElement).disabled = true));
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
