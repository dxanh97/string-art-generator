import { constrain, graph, render_image, registerGUI } from '../dist/core.js';

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

class Slider extends UIElement {
  public val: number;
  public min: number;
  public max: number;
  public element: HTMLInputElement;

  constructor(
    desc: string,
    name: string,
    parent: HTMLElement,
    init_val: number,
    min: number,
    max: number,
    callback: (value: number) => void,
  ) {
    super(desc, name, parent, callback, true);
    this.val = init_val;
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

class TextEntry extends UIElement {
  public element: HTMLInputElement;

  constructor(
    desc: string,
    name: string,
    parent: HTMLElement,
    value: string,
    callback: (event: Event) => void,
  ) {
    super(desc, name, parent, callback, true);
    this.element = document.createElement('input');
    this.element.type = 'text';
    this.element.value = value;
    this.element.addEventListener('change', callback);
    parent.appendChild(this.element);
  }
}

const downloadSection = document.getElementById('download');
const basicOptionsSection = document.getElementById('basic');
const controlsSection = document.getElementById('controls');

if (!downloadSection || !basicOptionsSection || !controlsSection) {
  throw new Error('Failed to initialise UI sections');
}

const GUI: any = {
  init() {
    this.nail_seq_download = new Button(
      'Nail sequence',
      'nail_sequence',
      downloadSection,
      () => {
        graph.download_nail_seq();
      },
    );
    this.frame_download = new Button(
      'Frame with numbering',
      'frame_download',
      downloadSection,
      () => {
        graph.download_frame();
      },
    );
    this.generate = new Button('Generate', 'generate', controlsSection, () =>
      render_image(),
    );
    this.num_nails = new Slider(
      'Number of nails:',
      'num_nails',
      basicOptionsSection,
      300,
      10,
      2000,
      (value) => {
        graph.num_nails = value;
        render_image();
      },
    );
    this.num_connections = new Slider(
      'Max # of connections:',
      'num_connections',
      basicOptionsSection,
      10000,
      100,
      15000,
      (value) => {
        graph.max_iter = value;
        render_image();
      },
    );
  },
};

GUI.init();
registerGUI(GUI);

const input = document.querySelector("input[type='file']");
if (!(input instanceof HTMLInputElement)) {
  throw new Error('File input element not found');
}
input.addEventListener('change', function (this: HTMLInputElement) {
  if (this.files && this.files[0]) {
    render_image(URL.createObjectURL(this.files[0]));
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
