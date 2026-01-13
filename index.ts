interface Config {
  resolutionScale: number;
  defaultBlurStrength: number;
  renderColour: [number, number, number, number];
  maxBlurSize: number;
}

const config: Config = {
  resolutionScale: 0.5,
  defaultBlurStrength: 1.0,
  renderColour: [0.0, 0.0, 0.0, 0.0],
  maxBlurSize: 20,
};

const fragmentShaderSrc: string = `
  precision mediump float;
  varying vec2 v_texcoord;
  uniform sampler2D u_texture;
  uniform vec4 u_shape;
  uniform float u_borderRadius;
  uniform vec2 u_resolution;
  uniform float u_blurStrength;

  const int blurSizing = ${config.maxBlurSize}; 

  float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
    return length(max(abs(centerPosition) - size + radius, 0.0)) - radius;
  }

  float gaussian(float x, float sigma) {
    return exp(-(x * x) / (2.0 * sigma * sigma)) / (sqrt(2.0 * 3.14159) * sigma);
  }

  void main() {
    vec2 pixelCoord = gl_FragCoord.xy;
    vec2 centerPosition = (pixelCoord - u_shape.xy);
    
    float distance = u_shape.w == 0.0
      ? length(centerPosition) - u_shape.z
      : roundedBoxSDF(centerPosition, u_shape.zw, u_borderRadius);
    
    if (distance > 0.0) discard;
    
    vec4 blurredColor = vec4(0.0);
    float totalWeight = 0.0;
    float sigma = u_blurStrength / 3.0;
    
    for (int x = -blurSizing; x <= blurSizing; x++) {
      for (int y = -blurSizing; y <= blurSizing; y++) {
        if (float(x * x + y * y) > u_blurStrength * u_blurStrength) continue;
        vec2 offset = vec2(float(x), float(y)) / u_resolution;
        float weight = gaussian(length(offset), sigma);
        blurredColor += texture2D(u_texture, v_texcoord + offset) * weight;
        totalWeight += weight;
      }
    }
    
    gl_FragColor = blurredColor / totalWeight;
  }
`;

const vertexShaderSrc: string = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  varying vec2 v_texcoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
  }
`;

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    position: number;
    texcoord: number;
  };
  uniformLocations: {
    shape: WebGLUniformLocation | null;
    borderRadius: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    blurStrength: WebGLUniformLocation | null;
  };
}

interface Buffers {
  vertexBuff: WebGLBuffer;
  texBuff: WebGLBuffer;
}

interface GameView {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  resize: (width: number, height: number) => void;
  setResolutionScale: (scale: number) => void;
  updateElements: (newElements: HTMLElement[]) => void;
  start: () => void;
}

function makeShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  const infoLog = gl.getShaderInfoLog(shader);
  if (infoLog) console.error(infoLog);
  return shader;
}

function createTexture(gl: WebGLRenderingContext): WebGLTexture | null {
  const tex = gl.createTexture();
  const texPixels = new Uint8Array([0, 0, 255, 255]);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, texPixels);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createBuffers(gl: WebGLRenderingContext): Buffers | null {
  const vertexBuff = gl.createBuffer();
  if (!vertexBuff) return null;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texBuff = gl.createBuffer();
  if (!texBuff) return null;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  return { vertexBuff, texBuff };
}

function createProgram(gl: WebGLRenderingContext): ProgramInfo | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  const vertexShader = makeShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
  const fragmentShader = makeShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
  
  if (!vertexShader || !fragmentShader) return null;
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
    return null;
  }

  return {
    program,
    attribLocations: {
      position: gl.getAttribLocation(program, 'a_position'),
      texcoord: gl.getAttribLocation(program, 'a_texcoord'),
    },
    uniformLocations: {
      shape: gl.getUniformLocation(program, 'u_shape'),
      borderRadius: gl.getUniformLocation(program, 'u_borderRadius'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      blurStrength: gl.getUniformLocation(program, 'u_blurStrength'),
    },
  };
}

function createGameView(
  canvas: HTMLCanvasElement,
  glassElements: HTMLElement[],
  resolutionScale: number = config.resolutionScale
): GameView | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: true,
    preserveDrawingBuffer: true,
    failIfMajorPerformanceCaveat: false
  });

  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }

  const tex = createTexture(gl);
  const programInfo = createProgram(gl);
  const buffers = createBuffers(gl);

  if (!programInfo || !buffers || !tex) {
    console.error('Failed to create shader program or buffers');
    return null;
  }

  gl.useProgram(programInfo.program);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(programInfo.program, 'u_texture'), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuff);
  gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.position);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texBuff);
  gl.vertexAttribPointer(programInfo.attribLocations.texcoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.texcoord);

  let currentResolutionScale = resolutionScale;
  let currentElements = glassElements;

  function render(): void {
    const canvasRect = canvas.getBoundingClientRect();
    if (!gl) throw new Error('WebGL context not found')
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!programInfo) throw new Error('Shader program not found')
    gl.useProgram(programInfo.program);

    currentElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const buffer = 1;
      const scaledLeft = Math.floor((rect.left - canvasRect.left) * currentResolutionScale) - buffer;
      const scaledTop = Math.floor((rect.top - canvasRect.top) * currentResolutionScale) - buffer;
      const scaledWidth = Math.ceil(rect.width * currentResolutionScale) + buffer * 2;
      const scaledHeight = Math.ceil(rect.height * currentResolutionScale) + buffer * 2;

      const centerX = scaledLeft + scaledWidth / 2;
      const centerY = gl.canvas.height - (scaledTop + scaledHeight / 2);

      const borderRadius = parseFloat(getComputedStyle(element).borderRadius);
      const isCircle = getComputedStyle(element).borderRadius.includes('%') &&
        parseFloat(getComputedStyle(element).borderRadius) >= 50;

      const blurStrength = parseFloat(element.dataset.blurStrength || '') || config.defaultBlurStrength;

      gl.uniform4f(programInfo.uniformLocations.shape, centerX, centerY,
        isCircle ? scaledWidth / 2 : scaledWidth / 2,
        isCircle ? 0 : scaledHeight / 2);
      gl.uniform1f(programInfo.uniformLocations.borderRadius, borderRadius * currentResolutionScale);
      gl.uniform2f(programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(programInfo.uniformLocations.blurStrength, blurStrength);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });

    requestAnimationFrame(render);
  }

  const gameView: GameView = {
    canvas,
    gl,
    resize: (width: number, height: number) => {
      const scaledWidth = Math.ceil(width * currentResolutionScale);
      const scaledHeight = Math.ceil(height * currentResolutionScale);

      canvas.width = scaledWidth;
      canvas.height = scaledHeight;

      gl.viewport(0, 0, scaledWidth, scaledHeight);
    },
    setResolutionScale: (scale: number) => {
      currentResolutionScale = scale;
      gameView.resize(window.innerWidth, window.innerHeight);
    },
    updateElements: (newElements: HTMLElement[]) => {
      currentElements = newElements;
    },
    start: () => {
      gl.clearColor(...config.renderColour);
      render();
    }
  };

  return gameView;
}

document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  let canvas: HTMLCanvasElement | null = null;
  let gameView: GameView | null = null;
  const trackedElements = new Set<HTMLElement>();

  const initCanvas = (): HTMLCanvasElement => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'render';
      Object.assign(canvas.style, {
        position: 'absolute',
        width: '100%',
      });
      body.insertBefore(canvas, body.firstChild);
    }
    return canvas;
  };

  const processElement = (element: HTMLElement): void => {
    if (trackedElements.has(element)) return;
    
    element.classList.add('relative');
    const classMatch = [...element.classList].find(c => c.startsWith("blured-"));
    let blured = config.defaultBlurStrength;
    
    if (classMatch) {
      const extractedValue = classMatch.replace("blured-", "");
      if (!isNaN(Number(extractedValue)) && extractedValue.trim() !== "") {
        blured = parseFloat(extractedValue);
      }
    }
    
    element.dataset.blurStrength = blured.toString();
    trackedElements.add(element);
  };

  const removeElement = (element: HTMLElement): boolean => {
    if (trackedElements.has(element)) {
      trackedElements.delete(element);
      delete element.dataset.blurStrength;
      return true;
    }
    return false;
  };

  const processAllElements = (): void => {
    const glassElements = document.querySelectorAll<HTMLElement>('[class*="blured"]');
    
    trackedElements.forEach(element => {
      const hasBlurClass = Array.from(element.classList).some(c => c.includes('blured'));
      if (!hasBlurClass) {
        removeElement(element);
      }
    });
    
    if (glassElements.length > 0) {
      if (!gameView) {
        const canvasEl = initCanvas();
        glassElements.forEach(processElement);
        
        gameView = createGameView(canvasEl, Array.from(trackedElements));
        
        if (gameView) {
          const updateSize = () => gameView?.resize(window.innerWidth, window.innerHeight);
          updateSize();
          window.addEventListener('resize', updateSize);
          gameView.start();
        }
      } else {
        glassElements.forEach(processElement);
        gameView.updateElements(Array.from(trackedElements));
      }
    } else if (gameView) {
      gameView.updateElements(Array.from(trackedElements));
    }
  };

  processAllElements();

  const observer = new MutationObserver((mutations) => {
    let hasNewBlurElements = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          if (element.classList && Array.from(element.classList).some(c => c.includes('blured'))) {
            processElement(element);
            hasNewBlurElements = true;
          }
          
          const children = element.querySelectorAll<HTMLElement>('[class*="blured"]');
          if (children.length > 0) {
            children.forEach(processElement);
            hasNewBlurElements = true;
          }
        }
      });

      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target as HTMLElement;
        if (Array.from(target.classList).some(c => c.includes('blured'))) {
          processElement(target);
          hasNewBlurElements = true;
        }
      }
    });

    if (hasNewBlurElements && gameView) {
      gameView.updateElements(Array.from(trackedElements));
    }
  });

  observer.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
  });


  window.refreshBlurElements = () => {
    processAllElements();
  };
});