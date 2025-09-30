import { constrain, graph, renderImage, type GraphOptions } from './core.js';

type NumberInput = HTMLInputElement;

function requireButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Expected button with id "${id}"`);
  }
  return element;
}

function requireNumberInput(id: string): NumberInput {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Expected number input with id "${id}"`);
  }
  return element;
}

const generateButton = requireButton('generate');
const nailSequenceButton = requireButton('nailSequence');
const frameDownloadButton = requireButton('frameDownload');
const numNailsInput = requireNumberInput('numNails');
const numConnectionsInput = requireNumberInput('numConnections');

const originalGenerateLabel = generateButton.innerHTML;

function handleProgress(progress: number): void {
  if (progress >= 1 || Number.isNaN(progress)) {
    generateButton.innerHTML = originalGenerateLabel;
    return;
  }
  const percent = (progress * 100).toFixed(2);
  generateButton.innerHTML = `<b>Generating... ${percent}%</b>`;
}

function clampInputValue(input: NumberInput): void {
  const min = input.min === '' ? Number.NEGATIVE_INFINITY : Number(input.min);
  const max = input.max === '' ? Number.POSITIVE_INFINITY : Number(input.max);
  const parsed = Number(input.value);
  if (!Number.isFinite(parsed)) {
    return;
  }
  const clamped = constrain(parsed, min, max);
  if (clamped !== parsed) {
    input.value = String(clamped);
  }
}

function readOptions(): GraphOptions {
  clampInputValue(numNailsInput);
  clampInputValue(numConnectionsInput);
  return {
    numNails: Number(numNailsInput.value),
    maxConnections: Number(numConnectionsInput.value),
    onProgress: handleProgress,
  };
}

function triggerRender(url?: string): void {
  const options = readOptions();
  renderImage(options, url);
}

generateButton.addEventListener('click', () => {
  triggerRender();
});

nailSequenceButton.addEventListener('click', () => {
  graph.downloadNailSeq();
});

frameDownloadButton.addEventListener('click', () => {
  graph.downloadFrame();
});

[numNailsInput, numConnectionsInput].forEach((input) => {
  input.addEventListener('change', () => {
    triggerRender();
  });
  input.addEventListener('blur', () => {
    clampInputValue(input);
  });
});

const fileInput = document.querySelector("input[type='file']");
if (!(fileInput instanceof HTMLInputElement)) {
  throw new Error('File input element not found');
}
fileInput.addEventListener('change', function (this: HTMLInputElement) {
  if (this.files && this.files[0]) {
    triggerRender(URL.createObjectURL(this.files[0]));
  }
});

triggerRender();

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('showUI') === 'false') {
  const ui = document.getElementById('ui');
  if (ui) {
    ui.style.display = 'none';
  }
  graph.svg.style('width', '100vw').style('left', '0px');
}
