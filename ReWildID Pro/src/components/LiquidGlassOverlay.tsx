/**
 * LiquidGlassOverlay - Single full-screen WebGL overlay for all liquid glass effects
 * 
 * This component renders a single Canvas that handles all glass bounding boxes,
 * with smooth animations between positions when switching images.
 */

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Paper, Typography, Fade, useTheme } from '@mui/material';
import { Detection } from '../types/electron';
import { translateSpecies } from '../constants/species';

// Module-level storage for animated position - persists across remounts
const persistentAnimatedBbox = {
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  initialized: false
};

// Module-level drag offset - persists across remounts
const dragState = {
  offsetX: 0,
  offsetY: 0,
  velocityX: 0,
  velocityY: 0,
  scale: 1,
  targetScale: 1
};

// Vertex shader
const vertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - liquid glass refraction effect
const fragmentShader = `
  uniform vec2 uResolution;
  uniform vec4 uBbox;          // x, y, width, height in pixels
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uBorderRadius;
  uniform float uThickness;
  uniform float uBaseHeight;
  uniform float uOpacity;
  
  varying vec2 vUv;

  // SDF for rounded rectangle
  float sdfRoundedRect(vec2 center, vec2 halfSize, vec2 p, float r) {
    vec2 q = abs(p - center) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // Get surface normal from SDF
  vec3 getNormal(float sd, float thickness) {
    float dx = dFdx(sd);
    float dy = dFdy(sd);
    float n_cos = clamp((thickness + sd) / thickness, 0.0, 1.0);
    float n_sin = sqrt(1.0 - n_cos * n_cos);
    return normalize(vec3(dx * n_cos, dy * n_cos, n_sin));
  }

  // Get dome height at this point
  float getHeight(float sd, float thickness) {
    if (sd >= 0.0) return 0.0;
    if (sd < -thickness) return thickness;
    float x = thickness + sd;
    return sqrt(thickness * thickness - x * x);
  }

  void main() {
    vec2 fragCoord = vUv * uResolution;
    
    // Calculate bbox center and half-size (flip Y for shader coords)
    // Slightly enlarge the dome beyond the bbox so distortion primarily
    // affects the area around the animal rather than only inside it.
    // Use a size-proportional offset to avoid huge halos for large bboxes.
    float edgeOffset = 0.18 * min(uBbox.z, uBbox.w);
    vec2 bboxCenter = vec2(uBbox.x + uBbox.z * 0.5, uResolution.y - (uBbox.y + uBbox.w * 0.5));
    vec2 bboxHalfSize = vec2(uBbox.z * 0.5 + edgeOffset, uBbox.w * 0.5 + edgeOffset);
    
    vec2 p = vec2(fragCoord.x, fragCoord.y);
    float sd = sdfRoundedRect(bboxCenter, bboxHalfSize, p, uBorderRadius + edgeOffset);
    
    // Outside the glass - fully transparent
    if (sd > 0.0) {
      discard;
    }
    
    vec3 normal = getNormal(sd, uThickness);
    float h = getHeight(sd, uThickness);
    
    // Incident ray (looking straight at screen)
    vec3 incident = vec3(0.0, 0.0, -1.0);
    
    // Chromatic aberration - more visible IOR difference per channel
    float index_r = 1.35;
    float index_g = 1.45;
    float index_b = 1.55;
    
    vec3 refract_r = refract(incident, normal, 1.0 / index_r);
    vec3 refract_g = refract(incident, normal, 1.0 / index_g);
    vec3 refract_b = refract(incident, normal, 1.0 / index_b);
    
    float len_r = (h + uBaseHeight) / max(abs(dot(vec3(0.0, 0.0, -1.0), refract_r)), 0.001);
    float len_g = (h + uBaseHeight) / max(abs(dot(vec3(0.0, 0.0, -1.0), refract_g)), 0.001);
    float len_b = (h + uBaseHeight) / max(abs(dot(vec3(0.0, 0.0, -1.0), refract_b)), 0.001);
    
    vec2 coord_r = fragCoord + refract_r.xy * len_r;
    vec2 coord_g = fragCoord + refract_g.xy * len_g;
    vec2 coord_b = fragCoord + refract_b.xy * len_b;
    
    // Sample with refraction offsets
    vec4 refractColor = vec4(
      texture2D(uTexture, coord_r / uResolution).r,
      texture2D(uTexture, coord_g / uResolution).g,
      texture2D(uTexture, coord_b / uResolution).b,
      1.0
    );
    
    // Fresnel reflection
    float fresnel = pow(1.0 - abs(dot(incident, normal)), 3.0);
    vec3 reflectVec = reflect(incident, normal);
    float envReflect = 0.5 + 0.5 * reflectVec.y;
    vec3 reflectColor = vec3(envReflect) * 0.3;
    
    // Combine refraction and reflection
    vec3 glassColor = mix(refractColor.rgb, reflectColor, fresnel * 0.4);
    glassColor = mix(glassColor, vec3(1.0), 0.05);
    
    // Edge highlight - make rim more pronounced for clearer bbox
    float edgeGlow = smoothstep(-uThickness * 0.18, 0.0, sd);
    glassColor += vec3(1.0) * edgeGlow * 0.40;
    
    // Anti-aliased edge, slightly stronger near the rim
    float baseAlpha = smoothstep(0.0, -2.0, sd) * uOpacity;
    float alpha = baseAlpha * (0.75 + edgeGlow * 0.5);
    
    gl_FragColor = vec4(glassColor, alpha);
  }
`;

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GlassRendererProps {
  imageUrl: string;
  targetBbox: BBox;
  containerWidth: number;
  containerHeight: number;
  onAnimatedPosition: (pos: { x: number; y: number; scale: number }) => void;
  isHovered: boolean;
  isDragging: boolean;
}

function GlassRenderer({ imageUrl, targetBbox, containerWidth, containerHeight, onAnimatedPosition, isHovered, isDragging }: GlassRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const textureRef = useRef<THREE.Texture | null>(null);
  const currentImageUrl = useRef<string>('');
  const [hasTexture, setHasTexture] = useState(false);

  // Initialize persistent state on first use
  if (!persistentAnimatedBbox.initialized) {
    persistentAnimatedBbox.x = containerWidth / 2 - 150;
    persistentAnimatedBbox.y = containerHeight / 2 - 100;
    persistentAnimatedBbox.width = 300;
    persistentAnimatedBbox.height = 200;
    persistentAnimatedBbox.initialized = true;
  }

  // Load texture when imageUrl changes
  useEffect(() => {
    if (!imageUrl || imageUrl === currentImageUrl.current) return;

    currentImageUrl.current = imageUrl;

    // Dispose old texture
    if (textureRef.current) {
      textureRef.current.dispose();
    }

    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      textureRef.current = tex;
      setHasTexture(true);

      // Force update the material's texture uniform
      if (meshRef.current) {
        const material = meshRef.current.material as THREE.ShaderMaterial;
        if (material.uniforms) {
          material.uniforms.uTexture.value = tex;
          material.needsUpdate = true;
        }
      }
    });

    return () => {
      // Cleanup on unmount
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [imageUrl]);

  // Create uniforms - these are created once but updated in useFrame
  const uniforms = useMemo(() => ({
    uResolution: { value: new THREE.Vector2(containerWidth, containerHeight) },
    uBbox: { value: new THREE.Vector4(persistentAnimatedBbox.x, persistentAnimatedBbox.y, persistentAnimatedBbox.width, persistentAnimatedBbox.height) },
    uTexture: { value: null },
    uTime: { value: 0 },
    uBorderRadius: { value: Math.min(targetBbox.width, targetBbox.height) * 0.12 },
    uThickness: { value: 25.0 },
    uBaseHeight: { value: 60.0 },
    uOpacity: { value: 1.0 }
  }), []);

  // Animate each frame - smooth lerp toward target using PERSISTENT state
  useFrame((state) => {
    if (!meshRef.current) return;

    const material = meshRef.current.material as THREE.ShaderMaterial;
    if (!material.uniforms) return;

    // Only animate when we have a valid target (width/height > 0)
    // This freezes position during image loading when bboxes is empty
    if (targetBbox.width > 0 && targetBbox.height > 0) {
      const lerp = 0.05; // Slower, smoother sliding
      persistentAnimatedBbox.x += (targetBbox.x - persistentAnimatedBbox.x) * lerp;
      persistentAnimatedBbox.y += (targetBbox.y - persistentAnimatedBbox.y) * lerp;
      persistentAnimatedBbox.width += (targetBbox.width - persistentAnimatedBbox.width) * lerp;
      persistentAnimatedBbox.height += (targetBbox.height - persistentAnimatedBbox.height) * lerp;
    }

    // Spring physics for drag offset when not dragging
    if (!isDragging) {
      // Spring back to origin with damped oscillation
      const springStrength = 0.15;
      const damping = 0.75;

      // Apply spring force toward origin
      dragState.velocityX += -dragState.offsetX * springStrength;
      dragState.velocityY += -dragState.offsetY * springStrength;

      // Apply damping
      dragState.velocityX *= damping;
      dragState.velocityY *= damping;

      // Update position
      dragState.offsetX += dragState.velocityX;
      dragState.offsetY += dragState.velocityY;

      // Snap to zero when close enough
      if (Math.abs(dragState.offsetX) < 0.1 && Math.abs(dragState.velocityX) < 0.1) {
        dragState.offsetX = 0;
        dragState.velocityX = 0;
      }
      if (Math.abs(dragState.offsetY) < 0.1 && Math.abs(dragState.velocityY) < 0.1) {
        dragState.offsetY = 0;
        dragState.velocityY = 0;
      }
    }

    // Bouncy scale animation on hover
    dragState.targetScale = isHovered ? 1.05 : 1.0;
    const scaleLerp = 0.12;
    dragState.scale += (dragState.targetScale - dragState.scale) * scaleLerp;

    // Calculate final position with drag offset
    const finalX = persistentAnimatedBbox.x + dragState.offsetX;
    const finalY = persistentAnimatedBbox.y + dragState.offsetY;
    const scaledWidth = persistentAnimatedBbox.width * dragState.scale;
    const scaledHeight = persistentAnimatedBbox.height * dragState.scale;
    // Adjust position to scale from center
    const scaleOffsetX = (scaledWidth - persistentAnimatedBbox.width) / 2;
    const scaleOffsetY = (scaledHeight - persistentAnimatedBbox.height) / 2;

    // Report position for label (use unscaled position for label placement)
    onAnimatedPosition({
      x: finalX,
      y: finalY,
      scale: dragState.scale
    });

    // Update uniforms with scaled dimensions
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uResolution.value.set(containerWidth, containerHeight);
    material.uniforms.uBbox.value.set(
      finalX - scaleOffsetX,
      finalY - scaleOffsetY,
      scaledWidth,
      scaledHeight
    );
    material.uniforms.uBorderRadius.value = Math.min(scaledWidth, scaledHeight) * 0.12;

    // Always update texture from ref (it changes when image changes)
    if (textureRef.current) {
      material.uniforms.uTexture.value = textureRef.current;
    }
  });

  // Don't render until we have a texture
  if (!hasTexture) return null;

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

export interface ReidInfo {
  individualDisplayName: string;
  individualColor: string;
  species: string;
}

export interface LiquidGlassOverlayProps {
  imageUrl: string;
  bboxes: { bbox: BBox; label?: string; detection?: Detection }[];
  containerWidth: number;
  containerHeight: number;
  customPopupContent?: React.ReactNode;
  reidResults?: ReidInfo[];
}

export const LiquidGlassOverlay: React.FC<LiquidGlassOverlayProps> = ({
  imageUrl,
  bboxes,
  containerWidth,
  containerHeight,
  customPopupContent,
  reidResults
}) => {
  const theme = useTheme();
  const [labelPosition, setLabelPosition] = useState({ x: containerWidth / 2, y: containerHeight / 2, scale: 1 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // Get first bbox as target (for now, single detection)
  // When bboxes is empty (during image loading), use 0-size target so animation freezes
  const targetBbox = bboxes[0]?.bbox || { x: 0, y: 0, width: 0, height: 0 };
  const label = bboxes[0]?.label;
  const detection = bboxes[0]?.detection;

  // Edge offset matches shader (50px)
  const edgeOffset = 55;

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: dragState.offsetX,
      offsetY: dragState.offsetY
    };
    // Reset velocity when starting drag
    dragState.velocityX = 0;
    dragState.velocityY = 0;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    // Linear, unconstrained dragging in both axes
    dragState.offsetX = dragStartRef.current.offsetX + deltaX;
    dragState.offsetY = dragStartRef.current.offsetY + deltaY;
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Add some momentum based on final offset for bouncier return
      dragState.velocityX = dragState.offsetX * 0.05;
      dragState.velocityY = dragState.offsetY * 0.05;
    }
  }, [isDragging]);

  // Global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible'
      }}
    >
      {/* Single WebGL Canvas */}
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 100] }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible'
        }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
      >
        <GlassRenderer
          imageUrl={imageUrl}
          targetBbox={targetBbox}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          onAnimatedPosition={setLabelPosition}
          isHovered={isHovered}
          isDragging={isDragging}
        />
      </Canvas>

      {/* Hover area - invisible clickable region over the glass */}
      {targetBbox.width > 0 && (
        <Box
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => !isDragging && setIsHovered(false)}
          onMouseDown={handleMouseDown}
          onDragStart={(e: React.DragEvent) => e.preventDefault()}
          sx={{
            position: 'absolute',
            left: labelPosition.x - edgeOffset,
            top: labelPosition.y - edgeOffset,
            width: (targetBbox.width + edgeOffset * 2) * labelPosition.scale,
            height: (targetBbox.height + edgeOffset * 2) * labelPosition.scale,
            pointerEvents: 'auto',
            cursor: isDragging ? 'grabbing' : 'grab',
            borderRadius: '30px',
            transition: isHovered && !isDragging ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            transform: isHovered && !isDragging ? 'scale(1.02)' : 'scale(1)',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          }}
        />
      )}

      {/* Label rendered in HTML for crisp text - fade out when dragging */}
      {label && (
        <div
          style={{
            position: 'absolute',
            left: labelPosition.x - 32,
            top: labelPosition.y - 56,
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 16,
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            pointerEvents: isDragging ? 'none' : 'auto',
            transform: `scale(${labelPosition.scale})`,
            transformOrigin: 'bottom left',
            opacity: isDragging ? 0 : 1,
            transition: 'opacity 0.2s ease-out'
          }}
        >
          {detection
            ? `${translateSpecies(label || '')} ${(detection.confidence * 100).toFixed(1)}%`
            : translateSpecies(label || '')}
        </div>
      )}

      {/* Info popup on hover */}
      {(detection || customPopupContent) && (
        <Fade in={isHovered}>
          <Paper
            sx={{
              position: 'absolute',
              left: labelPosition.x + targetBbox.width + edgeOffset + 16,
              top: labelPosition.y - edgeOffset,
              opacity: isDragging ? 0 : 1,
              transition: 'opacity 0.2s ease-out',
              width: 240,
              p: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(12px)',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              border: `1px solid ${theme.palette.divider}`,
              pointerEvents: 'auto',
              zIndex: 20,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => !isDragging && setIsHovered(false)}
          >
            {customPopupContent ? customPopupContent : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Classification Section */}
                <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  分类
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">物种</Typography>
                  <Box sx={{
                    bgcolor: 'rgba(66, 133, 244, 0.1)',
                    color: '#4285F4',
                    px: 1, py: 0.2,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {translateSpecies(detection?.label || '')}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">置信度</Typography>
                  <Typography variant="caption" fontWeight="600" sx={{ fontFamily: 'monospace' }}>
                    {((detection?.confidence ?? 0) * 100).toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">检测分数</Typography>
                  <Typography variant="caption" fontWeight="600" sx={{ fontFamily: 'monospace' }}>
                    {((detection?.detection_confidence ?? 0) * 100).toFixed(1)}%
                  </Typography>
                </Box>

                {/* Re-identification Section */}
                {reidResults && reidResults.length > 0 && (
                  <>
                    <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, mt: 1, pt: 1 }} />
                    <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      个体鉴别
                    </Typography>
                    {reidResults.map((reid, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">个体</Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          bgcolor: `${reid.individualColor}20`,
                          color: reid.individualColor,
                          px: 1, py: 0.2,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: reid.individualColor }} />
                          {reid.individualDisplayName}
                        </Box>
                      </Box>
                    ))}
                  </>
                )}
              </Box>
            )}
          </Paper>
        </Fade>
      )}
    </div>
  );
};

export default LiquidGlassOverlay;
