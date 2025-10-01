declare const d3: typeof import('d3');

export const constrain = (val: number, min: number, max: number): number =>
  val < min ? min : val > max ? max : val;

const map = (
  value: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;

class Color {
  public r: number;
  public g: number;
  public b: number;
  public a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

class Point {
  public x: number;
  public y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class RasterImage {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  getImagePoint(svgPoint: DOMPoint, boundingBox: DOMRect): Point {
    const x = Math.floor(
      map(
        svgPoint.x,
        boundingBox.x,
        boundingBox.x + boundingBox.width,
        0,
        this.width - 1,
      ),
    );
    const y = Math.floor(
      map(
        svgPoint.y,
        boundingBox.y,
        boundingBox.y + boundingBox.height,
        0,
        this.height - 1,
      ),
    );
    return new Point(x, y);
  }
}

class Line {
  public start: Point;
  public end: Point;
  public startAdj: Point;
  public endAdj: Point;
  public pixels: Point[];
  public fuzzRadius: number;
  public fade: number;

  constructor(start: Point, end: Point) {
    this.start = start;
    this.end = end;
    this.startAdj = graph.image.getImagePoint(
      this.start,
      graph.frameBoundingBox,
    );
    this.endAdj = graph.image.getImagePoint(this.end, graph.frameBoundingBox);
    this.pixels = [];
    this.fuzzRadius = 0;
    this.computePixelOverlap();

    this.fade = 1 / (graph.downscaleFactor * 1.8);
  }

  draw(ctx: CanvasRenderingContext2D, color: Color) {
    ctx.beginPath();
    ctx.moveTo(this.startAdj.x, this.startAdj.y);
    ctx.lineTo(this.endAdj.x, this.endAdj.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.fade})`;
    ctx.stroke();
  }

  computePixelOverlap() {
    this.pixels = [];
    const startPoint = this.startAdj;
    const endPoint = this.endAdj;
    let x0 = startPoint.x;
    const x1 = endPoint.x;
    let y0 = startPoint.y;
    const y1 = endPoint.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const currentPoint = new Point(x0, y0);
      this.pixels.push(currentPoint);

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  getLineDiff(color: Color) {
    const colorArr = [color.r, color.g, color.b, color.a];
    let totalDiff = 0;

    for (let i = 0; i < this.pixels.length; i++) {
      const p = this.pixels[i];
      const ind = (p.x + p.y * graph.image.width) * 4;
      let pixelDiff = 0;
      for (let j = 0; j < 4; j++) {
        const newColor =
          colorArr[j] * this.fade +
          graph.currentCtxData[ind + j] * (1 - this.fade);
        const diff =
          Math.abs(graph.originalCtxData[ind + j] - newColor) -
          Math.abs(
            graph.currentCtxData[ind + j] - graph.originalCtxData[ind + j],
          );
        pixelDiff += diff;
      }
      if (pixelDiff < 0) {
        totalDiff += pixelDiff;
      }
      if (pixelDiff > 0) {
        totalDiff += pixelDiff / 5;
      }
    }
    return Math.pow(totalDiff / this.pixels.length, 3);
  }

  addToBuffer(color: Color) {
    this.draw(graph.currentCtx, color);
    graph.currentCtxData = graph.currentCtx.getImageData(
      0,
      0,
      graph.image.width,
      graph.image.height,
    ).data;
  }
}

class Thread {
  public currentNail: number;
  public color: Color;
  public currentDist: number;
  public nailOrder: number[];
  public nextWeight: number;
  public nextNail: number;
  public nextValid: boolean;
  public nextLine: Line | null;
  public nextDist: number;
  public readHead: number;
  public previousConnections: Array<Array<boolean> | undefined>;

  constructor(startNail: number, color: Color) {
    this.currentNail = startNail;
    this.color = color;
    this.currentDist = Infinity;
    this.nailOrder = [startNail];
    this.nextWeight = -Infinity;
    this.nextNail = startNail;
    this.nextValid = false;
    this.nextLine = null;
    this.nextDist = Infinity;
    this.readHead = 0;
    this.previousConnections = [];
  }

  getNextNailWeight(image: RasterImage) {
    if (this.nextValid) {
      return this.nextDist;
    }
    const chords = graph.getConnections(this.currentNail, image);
    let minDist = Infinity;
    let minDistIndex = Math.floor(Math.random() * graph.numNails);
    chords.forEach((line, i) => {
      if (line) {
        let dist = line.getLineDiff(this.color);
        if (
          this.previousConnections[this.currentNail] &&
          this.previousConnections[this.currentNail][i] === true
        ) {
          dist = 0;
        }
        if (dist < minDist) {
          minDist = dist;
          minDistIndex = i;
        }
      }
    });
    if (minDist >= 0) {
      minDist = Infinity;
    }

    const selectedLine = chords[minDistIndex];
    if (!selectedLine) {
      this.nextValid = false;
      this.nextLine = null;
      this.nextDist = Infinity;
      return this.nextDist;
    }

    this.nextDist = minDist;
    this.nextNail = minDistIndex;
    this.nextLine = selectedLine;
    this.nextValid = true;
    return minDist;
  }

  moveToNextNail(image: RasterImage) {
    if (!this.nextValid) {
      this.getNextNailWeight(image);
    }
    if (!this.previousConnections[this.currentNail]) {
      this.previousConnections[this.currentNail] = [];
    }
    this.previousConnections[this.currentNail][this.nextNail] = true;
    this.nextLine?.addToBuffer(this.color);
    this.currentNail = this.nextNail;
    this.nailOrder.push(this.currentNail);
    this.nextValid = false;
    this.currentDist = this.nextDist;
    this.getNextNailWeight(image);
  }

  getNextNailNum() {
    const nail = this.nailOrder[this.readHead];
    this.readHead++;
    return nail;
  }

  getCurrentLine() {
    const start =
      graph.nailsPosition[this.nailOrder[this.nailOrder.length - 1]];
    const end = graph.nailsPosition[this.nailOrder[this.nailOrder.length - 2]];
    return [
      [start.x, start.y],
      [end.x, end.y],
    ];
  }
}

export type ProgressCallback = (progress: number) => void;

export interface GraphOptions {
  numNails: number;
  maxConnections: number;
  onProgress?: ProgressCallback;
  monochrome?: boolean;
}

const noopProgress: ProgressCallback = () => {};

export const graph: any = {
  options: {
    numNails: 300,
    maxConnections: 10000,
    onProgress: noopProgress,
    monochrome: false,
  } as GraphOptions,
  progressCallback: noopProgress,
  init(options: GraphOptions) {
    this.options = { ...options };
    this.progressCallback = options.onProgress ?? noopProgress;
    this.renderTimeoutId = null;
    this.renderIter = 0;
    this.width = 30;
    this.height = this.width;
    this.radius = this.width / 3;
    this.maxIter = options.maxConnections;
    this.numNails = options.numNails;
    this.monochrome = options.monochrome ?? false;

    this.downscaleFactor = 4;

    this.threadDiameter = 0.01; // thread width in inches
    this.nailDiameter = 0.1;
    this.nailsPosition = [];

    this.lineCache = {};

    this.threadOpacity = 1.0;
    this.threadOrder = [];

    this.svg = d3
      .select('body')
      .insert('svg', ':first-child')
      .attr('width', '100vw')
      .attr('viewBox', [
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height,
      ]);
    this.svg.append('g');
    this.svg.attr('desc', 'Created using michael-crum.com/string-art-gen');

    const framePath = this.svg
      .select('g')
      .append('circle')
      .attr('r', this.radius)
      .style('stroke', '#ffbe5700')
      .style('stroke-width', 10)
      .style('fill', 'none');

    this.frameBoundingBox = framePath.node().getBBox();

    const nailsList: number[] = [];
    for (let i = 0; i < this.numNails; i++) {
      nailsList.push(i);
    }
    const frameLength = framePath.node().getTotalLength();

    const nails = this.svg
      .select('g')
      .selectAll('circle.nail')
      .data(nailsList)
      .join('g')
      .attr('transform', (d) => {
        const pos = framePath
          .node()
          .getPointAtLength((d / this.numNails) * frameLength);
        this.nailsPosition.push(new Point(pos.x, pos.y));
        return `translate(${pos.x}, ${pos.y})`;
      });
    nails
      .append('circle')
      .attr('class', 'nail')
      .attr('r', this.nailDiameter / 2)
      .attr('fill', 'aqua');

    nails
      .append('text')
      .style('fill', 'black')
      .style('stroke-width', `${this.nailDiameter / 100}`)
      .style('stroke', 'white')
      .attr('dx', '0')
      .attr('dy', `${(this.nailDiameter / 2) * 0.7}`)
      .attr('font-size', `${this.nailDiameter}px`)
      .attr('text-anchor', 'middle')
      .text((d, i) => String(i));

    framePath.style('fill', 'white');

    const zoom = d3.zoom().on('zoom', handleZoom);

    function handleZoom(e: any) {
      d3.selectAll('svg > g').attr('transform', e.transform as any);
    }

    d3.select('svg').call(zoom as any);
  },
  downloadFrame() {
    const element = document.createElement('a');
    element.setAttribute('href', `${this.frameUrl}`);
    element.setAttribute('download', 'frame.svg');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },
  downloadNailSeq() {
    let output = `${this.renderIter} connections in total\n\n`;
    const length = this.threadOrder.length;
    for (let i = 0; i < length; i++) {
      const thread = this.threads[this.threadOrder[i]];
      if (i === 0 || this.threadOrder[i - 1] !== this.threadOrder[i]) {
        output += `\nThread: [${thread.color.r}, ${thread.color.g}, ${thread.color.b}]\n`;
      }

      output += thread.getNextNailNum();
      output += '\n';
    }
    for (let i = 0; i < this.threads.length; i++) {
      this.threads[i].readHead = 0;
    }
    const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(output);
    const element = document.createElement('a');
    element.setAttribute('href', `${url}`);
    element.setAttribute('download', 'nailSeq.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },
  getConnections(nailNumber: number) {
    const ret: Array<Line | null> = [];
    const src = this.nailsPosition[nailNumber];
    for (let i = 0; i < this.numNails; i++) {
      if (i === nailNumber) {
        ret[i] = null;
        continue;
      }
      const key = `${Math.min(i, nailNumber)}| ${Math.max(i, nailNumber)} `;
      const cache = this.lineCache[key];
      if (cache) {
        ret[i] = cache;
        continue;
      }
      const dst = this.nailsPosition[i];
      const line = new Line(src, dst);
      ret[i] = line;
      this.lineCache[key] = line;
    }
    return ret;
  },
  setup(image: RasterImage) {
    this.renderIter = 0;
    this.image = image;
    this.originalCtx = image.ctx;
    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = image.width;
    scratchCanvas.height = image.height;
    const currentCanvas = document.createElement('canvas');
    currentCanvas.width = image.width;
    currentCanvas.height = image.height;
    this.scratchCtx = scratchCanvas.getContext('2d');
    this.currentCtx = currentCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    this.currentCtx.fillStyle = 'grey';
    this.currentCtx.fillRect(0, 0, this.image.width, this.image.height);
    this.originalCtxData = this.originalCtx.getImageData(
      0,
      0,
      this.image.width,
      this.image.height,
    ).data;
    this.currentCtxData = this.currentCtx.getImageData(
      0,
      0,
      this.image.width,
      this.image.height,
    ).data;

    const threadColors = this.monochrome
      ? [new Color(0, 0, 0, 255), new Color(255, 255, 255, 255)]
      : [
          new Color(0, 255, 255, 255),
          new Color(255, 0, 255, 255),
          new Color(255, 255, 0, 255),
          new Color(255, 255, 255, 255),
          new Color(0, 0, 0, 255),
        ];
    this.threads = threadColors.map((color) => new Thread(0, color));
    this.svg.select('g').selectAll('.string').remove();
    this.threadOrder = [];
  },
  parseImage() {
    if (this.renderIter >= this.maxIter) {
      this.clean();
      return;
    }
    let minThread;
    let minThreadIndex;
    let minThreadWeight = Infinity;
    for (let i = 0; i < this.threads.length; i++) {
      const weight = this.threads[i].getNextNailWeight(this.image);
      if (weight <= minThreadWeight) {
        minThreadWeight = weight;
        minThreadIndex = i;
        minThread = this.threads[i];
      }
    }
    if (minThreadWeight === Infinity) {
      this.clean();
      return;
    }
    const progress = this.maxIter === 0 ? 1 : this.renderIter / this.maxIter;
    this.progressCallback(progress);
    minThread!.moveToNextNail(this.image);
    this.threadOrder.push(minThreadIndex!);
    if (minThread!.nailOrder.length > 1) {
      const simpleLine = d3.line();
      this.svg
        .select('g')
        .append('path')
        .attr('d', simpleLine(minThread!.getCurrentLine()))
        .attr('class', 'string')
        .style('stroke-width', this.threadDiameter)
        .style(
          'stroke',
          `rgba(${minThread!.color.r},${minThread!.color.g},${
            minThread!.color.b
          },${this.threadOpacity})`,
        )
        .style('fill', 'none');
    }

    this.renderIter++;
    this.renderTimeoutId = window.setTimeout(() => {
      this.parseImage();
    }, 0);
  },
  clean() {
    this.progressCallback(1);
    clearTimeout(this.renderTimeoutId);
    this.svg.selectAll('g circle.nail').raise();
  },
};

export function renderImage(options: GraphOptions, url?: string) {
  if (graph.svg) {
    graph.svg.selectAll('*').remove();
    graph.svg.remove();
    clearTimeout(graph.renderTimeoutId);
  }
  graph.init(options);
  graph.progressCallback(0);
  const img = document.getElementById('snapshot');
  if (!(img instanceof HTMLImageElement)) {
    throw new Error('Snapshot image element not found');
  }
  img.onload = () => {
    if (url) URL.revokeObjectURL(img.src);
  };
  if (url) {
    img.src = url;
  } else {
    img.src = img.src;
  }
  img.onload = function () {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire 2D rendering context');
    }

    const maxResolution =
      graph.frameBoundingBox.width /
      graph.threadDiameter /
      2 /
      graph.downscaleFactor;
    const frameAspectRatio =
      graph.frameBoundingBox.width / graph.frameBoundingBox.height;
    const imageAspectRatio = img.width / img.height;
    canvas.width =
      frameAspectRatio >= 1 ? maxResolution : maxResolution * frameAspectRatio;
    canvas.height =
      frameAspectRatio < 1 ? maxResolution : maxResolution / frameAspectRatio;
    const width =
      frameAspectRatio >= imageAspectRatio
        ? canvas.width
        : canvas.height * imageAspectRatio;
    const height =
      frameAspectRatio < imageAspectRatio
        ? canvas.height
        : canvas.width / imageAspectRatio;
    ctx.drawImage(
      img,
      -(width - canvas.width) / 2,
      -(height - canvas.height) / 2,
      width,
      height,
    );
    const rasterImage = new RasterImage(ctx, canvas.width, canvas.height);
    graph.setup(rasterImage);
    graph.parseImage();
  };
}
