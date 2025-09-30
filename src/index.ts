import { graph, renderImage, registerGUI } from './core.js';

type NumberInput = HTMLInputElement;

type GUIBindings = {
  generate: { element: HTMLButtonElement };
  numNails: { element: NumberInput };
  numConnections: { element: NumberInput };
};

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

const gui: GUIBindings = {
  generate: { element: generateButton },
  numNails: { element: numNailsInput },
  numConnections: { element: numConnectionsInput },
};

registerGUI(gui);

generateButton.addEventListener('click', () => {
  renderImage();
});

nailSequenceButton.addEventListener('click', () => {
  graph.downloadNailSeq();
});

frameDownloadButton.addEventListener('click', () => {
  graph.downloadFrame();
});

const fileInput = document.querySelector("input[type='file']");
if (!(fileInput instanceof HTMLInputElement)) {
  throw new Error('File input element not found');
}
fileInput.addEventListener('change', function (this: HTMLInputElement) {
  if (this.files && this.files[0]) {
    renderImage(URL.createObjectURL(this.files[0]));
  }
});
