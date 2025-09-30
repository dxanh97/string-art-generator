import { constrain, graph, renderImage, registerGUI } from './core.js';

class UIElement {
  public desc: string;
  public name: string;
  public parent: HTMLElement;
  public callback: (...args: unknown[]) => void;
  public label?: HTMLLabelElement;

  constructor(
    desc: string,
    name: string,
    parent: HTMLElement,
    callback: (...args: unknown[]) => void,
    addLabel: boolean,
  ) {
    this.desc = desc;
    this.name = name;
    this.parent = parent;
    this.callback = callback;
    if (addLabel) {
      this.label = document.createElement('label');
      this.label.htmlFor = name;
      this.label.innerHTML = desc;
      parent.appendChild(this.label);
    }
  }
}

class NumberInput extends UIElement {
  public val: number;
  public min: number;
  public max: number;
  public element: HTMLInputElement;

  constructor(
    desc: string,
    name: string,
    parent: HTMLElement,
    initialValue: number,
    min: number,
    max: number,
    callback: (value: number) => void,
  ) {
    super(desc, name, parent, callback, true);
    this.val = initialValue;
    this.min = min;
    this.max = max;
    this.element = document.createElement('input');
    this.element.id = name;
    this.element.type = 'number';
    this.element.classList.add('slider');
    this.element.min = String(min);
    this.element.max = String(max);
    this.element.step = '1';
    this.element.value = String(this.val);
    this.element.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value === '') {
        return;
      }
      const parsed = Number(target.value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const clamped = constrain(parsed, this.min, this.max);
      this.val = clamped;
      callback(clamped);
    });
    this.element.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const parsed = Number(target.value);
      const clamped = Number.isFinite(parsed)
        ? constrain(parsed, this.min, this.max)
        : this.min;
      this.val = clamped;
      target.value = String(clamped);
      callback(clamped);
    });
    parent.appendChild(this.element);
  }
}

class Button extends UIElement {
  public element: HTMLButtonElement;

  constructor(
    desc: string,
    name: string,
    parent: HTMLElement,
    callback: (event: Event) => void,
  ) {
    super(desc, name, parent, callback, false);
    this.element = document.createElement('button');
    this.element.id = name;
    this.element.innerHTML = `<b> ${this.desc}</b>`;
    this.element.addEventListener('click', callback);
    parent.appendChild(this.element);
  }
}

const downloadSection = document.getElementById('download');
const basicOptionsSection = document.getElementById('basic');
const controlsSection = document.getElementById('controls');

if (!downloadSection || !basicOptionsSection || !controlsSection) {
  throw new Error('Failed to initialize UI sections');
}

const GUI: any = {
  init() {
    this.nailSequenceDownload = new Button(
      'Nail sequence',
      'nailSequence',
      downloadSection,
      () => {
        graph.downloadNailSeq();
      },
    );
    this.frameDownload = new Button(
      'Frame with numbering',
      'frameDownload',
      downloadSection,
      () => {
        graph.downloadFrame();
      },
    );
    this.generate = new Button('Generate', 'generate', controlsSection, () =>
      renderImage(),
    );
    this.numNails = new NumberInput(
      'Number of nails:',
      'numNails',
      basicOptionsSection,
      300,
      10,
      2000,
      (value) => {
        graph.numNails = value;
        renderImage();
      },
    );
    this.numConnections = new NumberInput(
      'Max # of connections:',
      'numConnections',
      basicOptionsSection,
      10000,
      100,
      15000,
      (value) => {
        graph.maxIter = value;
        renderImage();
      },
    );
  },
};

GUI.init();
registerGUI(GUI);

renderImage();

const inputElement = document.querySelector("input[type='file']");
if (!(inputElement instanceof HTMLInputElement)) {
  throw new Error('File input element not found');
}
inputElement.addEventListener('change', function (this: HTMLInputElement) {
  if (this.files && this.files[0]) {
    renderImage(URL.createObjectURL(this.files[0]));
  }
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('showUI') === 'false') {
  const ui = document.getElementById('ui');
  if (ui) {
    ui.style.display = 'none';
  }
  graph.svg.style('width', '100vw').style('left', '0px');
}
