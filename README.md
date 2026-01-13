# FiveM GLSL rendering POC to manipulate the game screen.

![Project Preview](/screens/preview.png)

# Usage
## Compiling
To compile the project, run the following command in the terminal:
```bash
npm i
```
```bash
npm run build
```

## Importing
<script src="nui://fivem-glsl/index.js"></script>

## Using it
### On Runtime
<div class="blured"></div>
or 
<div class="blured-<value>"></div>

### After loading the wom
- make sure you run this after you put, remove or update the class
```ts
  ;(window as any).refreshBlurElements?.()
```

## Overview

This project demonstrates a proof-of-concept (POC) for applying GLSL-based blur effects over a FiveM game render. It uses WebGL to create customizable, real-time blur effects on specified elements over the game's user interface.

## Features (Built in)

- GLSL Support
- Support for both circular and rectangular blur regions
- Real-time blur effect using GLSL shaders
- Customizable blur strength
- Responsive adapts to window resizing

## Implementation Details

The project consists of three main files:

1. `index.html`: Defines the basic structure and blur effect elements
2. `gamerender.js`: Contains the WebGL implementation for the glsl and blur effect logic
3. `styles.css`: Basic CSS styles (for example)

Or include the `gamerender.js` in your project!

1. `gamerender.js`: Include in your project
2. Set data value on where you want glsl to render `data-hlsl` 
3. Example to control the strengh `data-blur-strength="5"`

### How it Works (The example *Glassmorphism/Blur*)

The script creates a WebGL context and renders a blurred version of the game screen behind specified elements. It uses a fragment shader to apply a Gaussian blur effect, which can be customized for each element.

### Usage

To apply the blur effect to an element, add the following data attributes:

- `data-hlsl`: Marks the element for blur effect application
- `data-blur-strength="5"`: Sets the blur strength (optional, default is 5)

Example:

```html
<div id="glass-square" data-hlsl data-blur-strength="20"></div>
<div id="glass-circle" data-hlsl data-blur-strength="5"></div>
```

## Performance Considerations

It's important to note that it's somewhat of a hacky solution and not intended for constant use. The performance impact can be noticeable, especially on lower-end systems or when multiple blur regions are active.

Consider the following when implementing this effect:

- Use sparingly and only when necessary
- Adjust the `resolutionScale` in the configuration to balance quality and performance (this is mainly for using the blur shader)
- Monitor frame rates and adjust accordingly

## Other examples Examples

Here are some examples of how i used this resource!

### LUT Effects
![LUT Example 1](/screens/luts/example1.png)
![LUT Example 2](/screens/luts/example2.png)
![LUT Example 3](/screens/luts/example3.png)

### Other Effects

![Emboss Example](/screens/other/emboss.png)
![Hue Emxaple](/screens/other/hue.png)


### Animated Effects

![Video Example](/screens/gif.gif)


## Configuration

The `config` object in `gamerender.js` allows you to adjust various parameters:

```javascript
const config = {
  resolutionScale: 0.5,  // Scale of the rendering resolution i would keep this at 0.2-1.0
  defaultBlurStrength: 5.0,  // Default blur strength
  zindex: '-1',  // z-index of game render
  renderColour: [0.0, 0.0, 0.0, 0.0],  // RGBA (for debugging cutouts)
  maxBlurSize: 20,  // Maximum blur size (affects performance and quality)
};
```

## Conclusion

This GLSL support effect provides a unique way to enhance the visual appeal of your FiveM NUI. However, due to its performance impact, it should be used judiciously and with careful consideration of your target audience's hardware capabilities.

Also please note that "tearing" is an issue where the canvas render is happening (this could be virtually invisible if perfomance is good on the clients game)

Feel free to experiment with different configurations and create new glsl shaders!


If you use this on the FiveM Platform please if you would be so kind mention me, my forum page is https://forum.cfx.re/u/kypos <3

I would love to see your usecases!

# Support my work
## https://ko-fi.com/kypos

[![Star History Chart](https://api.star-history.com/svg?repos=gtasnail/fivem-glsl&type=Date)](https://star-history.com/#gtasnail/fivem-glsl&Date)
