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

  get_image_point(svg_point: DOMPoint, bounding_box: DOMRect): Point {
    const x = Math.floor(
      map(
        svg_point.x,
        bounding_box.x,
        bounding_box.x + bounding_box.width,
        0,
        this.width - 1,
      ),
    );
    const y = Math.floor(
      map(
        svg_point.y,
        bounding_box.y,
        bounding_box.y + bounding_box.height,
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
  public start_adj: Point;
  public end_adj: Point;
  public pixels: Point[];
  public fuzz_rad: number;
  public fade: number;

  constructor(start: Point, end: Point) {
    this.start = start;
    this.end = end;
    this.start_adj = graph.img.get_image_point(this.start, graph.frame_bb);
    this.end_adj = graph.img.get_image_point(this.end, graph.frame_bb);
    this.pixels = [];
    this.fuzz_rad = 0;
    this.compute_pixel_overlap();

    this.fade = 1 / (graph.downscale_factor * 1.8);
  }

  draw(ctx: CanvasRenderingContext2D, color: Color) {
    ctx.beginPath();
    ctx.moveTo(this.start_adj.x, this.start_adj.y);
    ctx.lineTo(this.end_adj.x, this.end_adj.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.fade})`;
    ctx.stroke();
  }

  compute_pixel_overlap() {
    this.pixels = [];
    const start_point = this.start_adj;
    const end_point = this.end_adj;
    let x0 = start_point.x;
    const x1 = end_point.x;
    let y0 = start_point.y;
    const y1 = end_point.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const current_point = new Point(x0, y0);
      this.pixels.push(current_point);

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

  get_line_diff(color: Color) {
    const color_arr = [color.r, color.g, color.b, color.a];
    let total_diff = 0;

    for (let i = 0; i < this.pixels.length; i++) {
      const p = this.pixels[i];
      const ind = (p.x + p.y * graph.img.width) * 4;
      let pixel_diff = 0;
      for (let j = 0; j < 4; j++) {
        const new_c =
          color_arr[j] * this.fade +
          graph.current_ctx_data[ind + j] * (1 - this.fade);
        const diff =
          Math.abs(graph.orig_ctx_data[ind + j] - new_c) -
          Math.abs(
            graph.current_ctx_data[ind + j] - graph.orig_ctx_data[ind + j],
          );
        pixel_diff += diff;
      }
      if (pixel_diff < 0) {
        total_diff += pixel_diff;
      }
      if (pixel_diff > 0) {
        total_diff += pixel_diff / 5;
      }
    }
    return Math.pow(total_diff / this.pixels.length, 3);
  }

  add_to_buffer(color: Color) {
    this.draw(graph.current_ctx, color);
    graph.current_ctx_data = graph.current_ctx.getImageData(
      0,
      0,
      graph.img.width,
      graph.img.height,
    ).data;
  }
}

class Thread {
  public current_nail: number;
  public color: Color;
  public current_dist: number;
  public nail_order: number[];
  public next_weight: number;
  public next_nail: number;
  public next_valid: boolean;
  public next_line: Line | null;
  public next_dist: number;
  public read_head: number;
  public prev_connections: Array<Array<boolean> | undefined>;

  constructor(start_nail: number, color: Color) {
    this.current_nail = start_nail;
    this.color = color;
    this.current_dist = Infinity;
    this.nail_order = [start_nail];
    this.next_weight = -Infinity;
    this.next_nail = start_nail;
    this.next_valid = false;
    this.next_line = null;
    this.next_dist = Infinity;
    this.read_head = 0;
    this.prev_connections = [];
  }

  get_next_nail_weight(image: RasterImage) {
    if (this.next_valid) {
      return this.next_dist;
    }
    const chords = graph.get_connections(this.current_nail, image);
    let min_dist = Infinity;
    let min_dist_index = Math.floor(Math.random() * graph.num_nails);
    chords.forEach((line, i) => {
      if (line) {
        let dist = line.get_line_diff(this.color);
        if (
          this.prev_connections[this.current_nail] &&
          this.prev_connections[this.current_nail][i] === true
        ) {
          dist = 0;
        }
        if (dist < min_dist) {
          min_dist = dist;
          min_dist_index = i;
        }
      }
    });
    if (min_dist >= 0) {
      min_dist = Infinity;
    }

    const selectedLine = chords[min_dist_index];
    if (!selectedLine) {
      this.next_valid = false;
      this.next_line = null;
      this.next_dist = Infinity;
      return this.next_dist;
    }

    this.next_dist = min_dist;
    this.next_nail = min_dist_index;
    this.next_line = selectedLine;
    this.next_valid = true;
    return min_dist;
  }

  move_to_next_nail(image: RasterImage) {
    if (!this.next_valid) {
      this.get_next_nail_weight(image);
    }
    if (!this.prev_connections[this.current_nail]) {
      this.prev_connections[this.current_nail] = [];
    }
    this.prev_connections[this.current_nail][this.next_nail] = true;
    this.next_line?.add_to_buffer(this.color);
    this.current_nail = this.next_nail;
    this.nail_order.push(this.current_nail);
    this.next_valid = false;
    this.current_dist = this.next_dist;
    this.get_next_nail_weight(image);
  }

  get_next_nail_num() {
    const nail = this.nail_order[this.read_head];
    this.read_head++;
    return nail;
  }

  get_current_line() {
    const start = graph.nails_pos[this.nail_order[this.nail_order.length - 1]];
    const end = graph.nails_pos[this.nail_order[this.nail_order.length - 2]];
    return [
      [start.x, start.y],
      [end.x, end.y],
    ];
  }
}

let guiRef: any | null = null;

const getGUI = () => {
  if (!guiRef) {
    throw new Error('GUI not registered');
  }
  return guiRef;
};

export const registerGUI = (gui: any) => {
  guiRef = gui;
};

export const graph: any = {
  init() {
    const GUI = getGUI();
    this.render_timeout_id = null;
    this.render_iter = 0;
    this.width = 30;
    this.height = this.width;
    this.radius = this.width / 3;
    this.max_iter = Number(GUI.num_connections.element.value);
    this.num_nails = Number(GUI.num_nails.element.value);

    this.downscale_factor = 4;

    this.thread_diam = 0.01; // thread width in inches
    this.nail_diam = 0.1;
    this.nails_pos = [];

    this.line_cache = {};

    this.thread_opacity = 1.0;
    this.thread_order = [];

    this.svg = d3
      .select('body')
      .insert('svg', ':first-child')
      .attr('width', '100vw')
      .attr('viewBox', [-this.width / 2, -this.height / 2, this.width, this.height]);
    this.svg.append('g');
    this.svg.attr('desc', 'Created using michael-crum.com/string-art-gen');

    const frame_path = this.svg
      .select('g')
      .append('circle')
      .attr('r', this.radius)
      .style('stroke', '#ffbe5700')
      .style('stroke-width', 10)
      .style('fill', 'none');

    this.frame_bb = frame_path.node().getBBox();

    const nails_lst: number[] = [];
    for (let i = 0; i < this.num_nails; i++) {
      nails_lst.push(i);
    }
    const frame_length = frame_path.node().getTotalLength();

    const nails = this.svg
      .select('g')
      .selectAll('circle.nail')
      .data(nails_lst)
      .join('g')
      .attr('transform', (d) => {
        const pos = frame_path.node().getPointAtLength((d / this.num_nails) * frame_length);
        this.nails_pos.push(new Point(pos.x, pos.y));
        return `translate(${pos.x}, ${pos.y})`;
      });
    nails
      .append('circle')
      .attr('class', 'nail')
      .attr('r', this.nail_diam / 2)
      .attr('fill', 'aqua');

    nails
      .append('text')
      .style('fill', 'black')
      .style('stroke-width', `${this.nail_diam / 100}`)
      .style('stroke', 'white')
      .attr('dx', '0')
      .attr('dy', `${(this.nail_diam / 2) * 0.7}`)
      .attr('font-size', `${this.nail_diam}px`)
      .attr('text-anchor', 'middle')
      .text((d, i) => String(i));

    this.get_frame_url();
    frame_path.style('fill', 'grey');

    const zoom = d3.zoom().on('zoom', handleZoom);

    function handleZoom(e: any) {
      d3.selectAll('svg > g').attr('transform', e.transform as any);
    }

    d3.select('svg').call(zoom as any);
  },
  get_frame_url() {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(this.svg.node());

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(
        /^<svg/,
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"',
      );
    }

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    this.frame_url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  },
  download_frame() {
    const element = document.createElement('a');
    element.setAttribute('href', `${this.frame_url}`);
    element.setAttribute('download', 'frame.svg');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },
  download_nail_seq() {
    let output = `Generated using https://michael-crum.com/string-art-gen/\n${this.render_iter} connections in total\n\n`;
    const len = this.thread_order.length;
    for (let i = 0; i < len; i++) {
      const thread = this.threads[this.thread_order[i]];
      if (i === 0 || this.thread_order[i - 1] !== this.thread_order[i]) {
        output += `\nThread: [${thread.color.r}, ${thread.color.g}, ${thread.color.b}]\n`;
      }

      output += thread.get_next_nail_num();
      output += '\n';
    }
    for (let i = 0; i < this.threads.length; i++) {
      this.threads.read_head = 0;
    }
    const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(output);
    const element = document.createElement('a');
    element.setAttribute('href', `${url}`);
    element.setAttribute('download', 'nail_seq.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },
  get_connections(nail_num: number) {
    const ret: Array<Line | null> = [];
    const src = this.nails_pos[nail_num];
    for (let i = 0; i < this.num_nails; i++) {
      if (i === nail_num) {
        ret[i] = null;
        continue;
      }
      const key = `${Math.min(i, nail_num)}| ${Math.max(i, nail_num)} `;
      const cache = this.line_cache[key];
      if (cache) {
        ret[i] = cache;
        continue;
      }
      const dst = this.nails_pos[i];
      const line = new Line(src, dst);
      ret[i] = line;
      this.line_cache[key] = line;
    }
    return ret;
  },
  setup(img: RasterImage) {
    this.render_iter = 0;
    this.img = img;
    this.image = img;
    this.orig_ctx = img.ctx;
    const scratch_canvas = document.createElement('canvas');
    scratch_canvas.width = img.width;
    scratch_canvas.height = img.height;
    const current_canvas = document.createElement('canvas');
    current_canvas.width = img.width;
    current_canvas.height = img.height;
    this.scratch_ctx = scratch_canvas.getContext('2d');
    this.current_ctx = current_canvas.getContext('2d', { willReadFrequently: true });
    this.current_ctx.fillStyle = 'grey';
    this.current_ctx.fillRect(0, 0, this.img.width, this.img.height);
    this.orig_ctx_data = this.orig_ctx.getImageData(0, 0, this.img.width, this.img.height).data;
    this.current_ctx_data = this.current_ctx.getImageData(0, 0, this.img.width, this.img.height).data;

    this.threads = [
      new Thread(0, new Color(0, 255, 255, 255)),
      new Thread(0, new Color(255, 0, 255, 255)),
      new Thread(0, new Color(255, 255, 0, 255)),
      new Thread(0, new Color(0, 0, 0, 255)),
      new Thread(0, new Color(255, 255, 255, 255)),
    ];
    this.svg.select('g').selectAll('.string').remove();
    this.thread_order = [];
  },
  parse_image() {
    if (this.render_iter >= this.max_iter) {
      this.clean();
      return;
    }
    let min_thread;
    let min_thread_index;
    let min_thread_weight = Infinity;
    for (let i = 0; i < this.threads.length; i++) {
      const weight = this.threads[i].get_next_nail_weight(this.image);
      if (weight <= min_thread_weight) {
        min_thread_weight = weight;
        min_thread_index = i;
        min_thread = this.threads[i];
      }
    }
    if (min_thread_weight === Infinity) {
      this.clean();
      return;
    }
    const GUI = getGUI();
    GUI.generate.element.innerHTML = `<b>Generating... ${(
      (this.render_iter / this.max_iter) *
      100
    ).toFixed(2)}</b>%`;
    min_thread!.move_to_next_nail(this.image);
    this.thread_order.push(min_thread_index!);
    if (min_thread!.nail_order.length > 1) {
      const simpleLine = d3.line();
      this.svg
        .select('g')
        .append('path')
        .attr('d', simpleLine(min_thread!.get_current_line()))
        .attr('class', 'string')
        .style('stroke-width', this.thread_diam)
        .style(
          'stroke',
          `rgba(${min_thread!.color.r},${min_thread!.color.g},${min_thread!.color.b},${this.thread_opacity})`,
        )
        .style('fill', 'none');
    }

    this.render_iter++;
    this.render_timeout_id = window.setTimeout(() => {
      this.parse_image();
    }, 0);
  },
  clean() {
    const GUI = getGUI();
    GUI.generate.element.innerHTML = '<b>Generate</b>';
    clearTimeout(this.render_timeout_id);
    this.svg.selectAll('g circle.nail').raise();
  },
};

export function render_image(url?: string) {
  if (graph.svg) {
    graph.svg.selectAll('*').remove();
    graph.svg.remove();
    clearTimeout(graph.render_timeout_id);
  }
  graph.init();
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

    const max_res =
      (graph.frame_bb.width / graph.thread_diam / 2) / graph.downscale_factor;
    const frame_ar = graph.frame_bb.width / graph.frame_bb.height;
    const img_ar = img.width / img.height;
    canvas.width = frame_ar >= 1 ? max_res : max_res * frame_ar;
    canvas.height = frame_ar < 1 ? max_res : max_res / frame_ar;
    const w = frame_ar >= img_ar ? canvas.width : canvas.height * img_ar;
    const h = frame_ar < img_ar ? canvas.height : canvas.width / img_ar;
    ctx.drawImage(
      img,
      -(w - canvas.width) / 2,
      -(h - canvas.height) / 2,
      w,
      h,
    );
    const new_img = new RasterImage(ctx, canvas.width, canvas.height);
    graph.setup(new_img);
    graph.parse_image();
  };
}

export const renderImage = render_image;
