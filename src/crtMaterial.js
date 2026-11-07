import * as THREE from 'three';

/**
 * CRT screen shader. One uniform, uCrt (1 → 0), drives every effect so the
 * zoom can ease the tube away. At uCrt = 0 and uPower = 1 the output is the
 * texture exactly, which is what makes the hand-off to HTML seamless.
 */
export function createCrtMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uCrt: { value: 1 },
      uTime: { value: 0 },
      uPower: { value: 0 },
      uHover: { value: 0 },
      uLines: { value: 230 },
    },
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uCrt, uTime, uPower, uHover, uLines;
      varying vec2 vUv;

      float roundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }

      void main() {
        // Barrel distortion (curved glass)
        vec2 c = vUv - 0.5;
        vec2 uv = 0.5 + c * (1.0 + 0.32 * uCrt * dot(c, c)) * (1.0 - 0.035 * uCrt);
        vec2 cc = uv - 0.5;

        // Rounded tube corners
        float d = roundedBox(cc, vec2(0.5 + 0.004 * (1.0 - uCrt)), 0.085 * uCrt);
        float inside = 1.0 - smoothstep(-0.003, 0.002, d);

        vec3 col = texture2D(map, clamp(uv, 0.0, 1.0)).rgb;

        // Phosphor haze + slight desaturation
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * vec3(0.94, 1.04, 1.0), 0.22 * uCrt);
        col = mix(col, vec3(0.55, 0.78, 0.72), 0.06 * uCrt);

        // Scanlines, rolling bar, flicker
        float sl = 0.5 + 0.5 * cos(uv.y * uLines * 6.28318);
        col *= 1.0 - 0.24 * uCrt * sl;
        float bar = exp(-pow(fract(uv.y * 0.7 - uTime * 0.11) - 0.5, 2.0) * 60.0);
        col *= 1.0 + 0.06 * uCrt * bar;
        col *= 1.0 - 0.018 * uCrt * sin(uTime * 55.0);

        // Vignette + hover brighten
        col *= mix(1.0, 1.0 - dot(cc, cc) * 1.6, uCrt);
        col *= 1.0 + 0.08 * uHover * uCrt;

        // Power-on: a dot stretches into a line, then the line opens vertically
        float hx = smoothstep(0.0, 0.3, uPower);
        float vy = smoothstep(0.25, 0.85, uPower);
        float halfH = mix(0.003, 0.52, vy * vy);
        float band = (1.0 - smoothstep(halfH - 0.004, halfH + 0.004, abs(vUv.y - 0.5)))
                   * (1.0 - smoothstep(hx * 0.52 - 0.01, hx * 0.52, abs(vUv.x - 0.5)));
        vec3 flash = vec3(0.85, 1.0, 0.95) * (1.8 - vy * 0.8);
        vec3 lit = mix(flash, col, smoothstep(0.55, 1.0, uPower));

        // Dark glass with a diagonal reflection streak
        float refl = smoothstep(0.32, 0.0, abs(vUv.x * 0.7 + vUv.y - 1.1)) * 0.05;
        vec3 off = vec3(0.035, 0.04, 0.04) + refl;

        vec3 outc = mix(off, lit, band) + vec3(refl) * 0.8 * uCrt * band;
        outc = mix(vec3(0.015), outc, inside);
        gl_FragColor = vec4(outc, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
