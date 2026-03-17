import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { DIGIT_PATHS } from '../utils/botDrawing';

export type DrawAction = 
  | { type: 'start'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'end' }
  | { type: 'clear' };

export interface DrawingCanvasRef {
  clear: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  simulateDrawing: (text: string, durationMs: number) => Promise<void>;
  executeDrawAction: (action: DrawAction) => void;
}

interface DrawingCanvasProps {
  className?: string;
  onDrawEnd?: () => void;
  disabled?: boolean;
  onDrawAction?: (action: DrawAction) => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ className, onDrawEnd, disabled, onDrawAction }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>();
  const isDrawingSim = useRef(false);

  // Refs for smoothing and adaptive thickness
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastMidPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentLineWidthRef = useRef<number>(20);

  const MIN_LINE_WIDTH = 12;
  const MAX_LINE_WIDTH = 25;

  useImperativeHandle(ref, () => ({
    clear: () => {
      if (ctx && canvasRef.current) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      isDrawingSim.current = false;
    },
    getCanvas: () => canvasRef.current,
    executeDrawAction: (action: DrawAction) => {
      const canvas = canvasRef.current;
      if (!canvas || !ctx) return;
      
      const w = canvas.width;
      const h = canvas.height;

      if (action.type === 'clear') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, w, h);
      } else if (action.type === 'start') {
        const x = action.x * w;
        const y = action.y * h;
        lastPointRef.current = { x, y, time: Date.now() };
        lastMidPointRef.current = { x, y };
        currentLineWidthRef.current = MAX_LINE_WIDTH;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
        ctx.lineWidth = currentLineWidthRef.current;
        ctx.stroke();
      } else if (action.type === 'move') {
        const x = action.x * w;
        const y = action.y * h;
        const currentPos = { x, y };
        const currentTime = Date.now();
        const lastPoint = lastPointRef.current;
        const lastMidPoint = lastMidPointRef.current;

        if (!lastPoint || !lastMidPoint) return;

        const dist = Math.hypot(currentPos.x - lastPoint.x, currentPos.y - lastPoint.y);
        const timeDelta = Math.max(1, currentTime - lastPoint.time);
        const speed = dist / timeDelta;

        let targetLineWidth = MAX_LINE_WIDTH - (speed * 4);
        targetLineWidth = Math.max(MIN_LINE_WIDTH, Math.min(MAX_LINE_WIDTH, targetLineWidth));
        currentLineWidthRef.current += (targetLineWidth - currentLineWidthRef.current) * 0.3;

        const midPoint = {
          x: (lastPoint.x + currentPos.x) / 2,
          y: (lastPoint.y + currentPos.y) / 2
        };

        ctx.beginPath();
        ctx.moveTo(lastMidPoint.x, lastMidPoint.y);
        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
        ctx.lineWidth = currentLineWidthRef.current;
        ctx.stroke();

        lastPointRef.current = { ...currentPos, time: currentTime };
        lastMidPointRef.current = midPoint;
      } else if (action.type === 'end') {
        ctx.closePath();
      }
    },
    simulateDrawing: async (text: string, durationMs: number) => {
      return new Promise<void>((resolve) => {
        isDrawingSim.current = true;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return resolve();

        context.fillStyle = 'black';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = 'white';
        context.lineWidth = 15;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        const chars = text.split('');
        const charWidth = canvas.width / chars.length;
        const padding = charWidth * 0.2;

        type Segment = { x1: number, y1: number, x2: number, y2: number, length: number };
        const segments: Segment[] = [];
        let totalLength = 0;

        chars.forEach((char, i) => {
          const strokes = DIGIT_PATHS[char] || [];
          const offsetX = i * charWidth + padding;
          const usableWidth = charWidth - padding * 2;
          const offsetY = canvas.height * 0.2;
          const usableHeight = canvas.height * 0.6;

          strokes.forEach(stroke => {
            for (let j = 0; j < stroke.length - 1; j++) {
              const p1 = stroke[j];
              const p2 = stroke[j+1];
              const x1 = offsetX + p1.x * usableWidth;
              const y1 = offsetY + p1.y * usableHeight;
              const x2 = offsetX + p2.x * usableWidth;
              const y2 = offsetY + p2.y * usableHeight;
              const length = Math.hypot(x2 - x1, y2 - y1);
              segments.push({ x1, y1, x2, y2, length });
              totalLength += length;
            }
          });
        });

        if (totalLength === 0) return resolve();

        let startTime: number | null = null;

        const drawFrame = (timestamp: number) => {
          if (!isDrawingSim.current) return resolve();
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const targetLength = progress * totalLength;

          context.fillStyle = 'black';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.beginPath();
          
          let currentLength = 0;
          for (const seg of segments) {
            if (currentLength + seg.length <= targetLength) {
              context.moveTo(seg.x1, seg.y1);
              context.lineTo(seg.x2, seg.y2);
              currentLength += seg.length;
            } else {
              const remaining = targetLength - currentLength;
              const ratio = remaining / seg.length;
              const px = seg.x1 + (seg.x2 - seg.x1) * ratio;
              const py = seg.y1 + (seg.y2 - seg.y1) * ratio;
              context.moveTo(seg.x1, seg.y1);
              context.lineTo(px, py);
              break;
            }
          }
          context.stroke();

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(drawFrame);
          } else {
            isDrawingSim.current = false;
            resolve();
          }
        };

        animationRef.current = requestAnimationFrame(drawFrame);
      });
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 20; // Thickening: Increased from 12 to 20
        context.strokeStyle = 'white';
        context.fillStyle = 'black';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setCtx(context);
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !ctx || !canvasRef.current) return;
    setIsDrawing(true);
    const pos = getPos(e);
    
    lastPointRef.current = { ...pos, time: Date.now() };
    lastMidPointRef.current = pos;
    currentLineWidthRef.current = MAX_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y); // Draw a dot for single clicks
    ctx.lineWidth = currentLineWidthRef.current;
    ctx.stroke();

    if (onDrawAction) {
      onDrawAction({ type: 'start', x: pos.x / canvasRef.current.width, y: pos.y / canvasRef.current.height });
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || !ctx || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();
    
    const currentPos = getPos(e);
    const currentTime = Date.now();
    const lastPoint = lastPointRef.current;
    const lastMidPoint = lastMidPointRef.current;

    if (!lastPoint || !lastMidPoint) return;

    // Calculate speed for adaptive thickness
    const dist = Math.hypot(currentPos.x - lastPoint.x, currentPos.y - lastPoint.y);
    const timeDelta = Math.max(1, currentTime - lastPoint.time);
    const speed = dist / timeDelta;

    // Map speed to line width (faster = thinner)
    let targetLineWidth = MAX_LINE_WIDTH - (speed * 4);
    targetLineWidth = Math.max(MIN_LINE_WIDTH, Math.min(MAX_LINE_WIDTH, targetLineWidth));

    // Smooth transition for line width
    currentLineWidthRef.current += (targetLineWidth - currentLineWidthRef.current) * 0.3;

    // Calculate midpoint for quadratic curve smoothing
    const midPoint = {
      x: (lastPoint.x + currentPos.x) / 2,
      y: (lastPoint.y + currentPos.y) / 2
    };

    ctx.beginPath();
    ctx.moveTo(lastMidPoint.x, lastMidPoint.y);
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
    ctx.lineWidth = currentLineWidthRef.current;
    ctx.stroke();

    lastPointRef.current = { ...currentPos, time: currentTime };
    lastMidPointRef.current = midPoint;

    if (onDrawAction) {
      onDrawAction({ type: 'move', x: currentPos.x / canvasRef.current.width, y: currentPos.y / canvasRef.current.height });
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (ctx) {
      ctx.closePath();
    }
    if (onDrawAction) {
      onDrawAction({ type: 'end' });
    }
    if (onDrawEnd) {
      onDrawEnd();
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  return (
    <div className={cn("relative overflow-hidden bg-black touch-none", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />
      <button 
        onClick={(e) => {
          e.preventDefault();
          if (ctx && canvasRef.current) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          if (onDrawAction) onDrawAction({ type: 'clear' });
        }}
        className="absolute top-2 right-2 pixel-btn px-3 py-1 text-xs z-10"
        disabled={disabled}
      >
        CLEAR
      </button>
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';
