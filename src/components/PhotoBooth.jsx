import { useCallback, useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const FINGER_TIP = 8;
const THUMB_TIP = 4;
const WRIST = 0;
const PINCH_THRESHOLD = 0.05;
const HEART_COOLDOWN_MS = 1200;

export default function PhotoBooth({ neonColor, clearToken, isRecording, onRecordingReady }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef();
  const cameraRef = useRef();
  const mediaRecorderRef = useRef();

  // performance-related change: move fast-changing data to refs to avoid rerenders per frame.
  const trailRef = useRef([]);
  const particlesRef = useRef([]);
  const heartsRef = useRef([]);
  const handRef = useRef(null);
  const fingertipsRef = useRef([]);
  const handStateRef = useRef({ isPinching: false, isTracking: false });
  const heartCooldownRef = useRef(0);

  const dims = useMemo(() => ({ width: 1280, height: 720 }), []);

  // particle triggers: sparkle emitter for raised open hand gesture.
  const emitSparkles = useCallback((x, y) => {
    for (let i = 0; i < 4; i += 1) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 24,
        r: 1.5 + Math.random() * 2.5,
        life: 1,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -1.6 - Math.random() * 1.8,
      });
    }
  }, []);

  // particle triggers: hearts on dual-hand pinch with cooldown.
  const explodeHearts = useCallback((x, y) => {
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      heartsRef.current.push({
        x,
        y,
        life: 1,
        vx: Math.cos(angle) * (1.6 + Math.random() * 1.3),
        vy: Math.sin(angle) * (1.6 + Math.random() * 1.3) - 0.8,
        s: 12 + Math.random() * 9,
      });
    }
  }, []);

  useEffect(() => {
    trailRef.current = [];
  }, [clearToken]);

  useEffect(() => {
    if (!webcamRef.current?.video) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.55,
    });

    // gesture detection + fingertip tracking
    hands.onResults((results) => {
      const landmarks = results.multiHandLandmarks ?? [];
      // debug logging: verify MediaPipe hand detection data each callback.
      console.log('hands:', results.multiHandLandmarks);
      fingertipsRef.current = [];

      if (!landmarks.length) {
        handRef.current = null;
        handStateRef.current.isTracking = false;
        handStateRef.current.isPinching = false;
        return;
      }

      handRef.current = landmarks[0];
      handStateRef.current.isTracking = true;

      let pinchCount = 0;
      for (const hand of landmarks) {
        const indexTip = hand[FINGER_TIP];
        const thumbTip = hand[THUMB_TIP];
        const wrist = hand[WRIST];

        // coordinate flipping: webcam is mirrored, so flip x-space for all effects/drawing.
        const tipX = (1 - indexTip.x) * dims.width;
        const tipY = indexTip.y * dims.height;
        fingertipsRef.current.push({ x: tipX, y: tipY });

        const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinching = pinchDistance < PINCH_THRESHOLD;
        if (isPinching) pinchCount += 1;

        // Gesture B: open hand + raised wrist => sparkles.
        if (!isPinching && wrist.y < 0.4) emitSparkles(tipX, tipY);

        // Gesture A: draw only while pinching.
        if (isPinching) {
          trailRef.current.push({ x: tipX, y: tipY });
        }
      }

      handStateRef.current.isPinching = pinchCount > 0;
      if (trailRef.current.length > 220) {
        trailRef.current = trailRef.current.slice(-220);
      }

      // Gesture C: both hands pinching => heart burst with cooldown.
      const now = performance.now();
      if (pinchCount >= 2 && now - heartCooldownRef.current > HEART_COOLDOWN_MS) {
        heartCooldownRef.current = now;
        const mid = fingertipsRef.current.reduce(
          (acc, p) => ({ x: acc.x + p.x / fingertipsRef.current.length, y: acc.y + p.y / fingertipsRef.current.length }),
          { x: 0, y: 0 }
        );
        explodeHearts(mid.x, mid.y);
      }
    });

    cameraRef.current = new Camera(webcamRef.current.video, {
      onFrame: async () => {
        await hands.send({ image: webcamRef.current.video });
      },
      width: dims.width,
      height: dims.height,
    });

    cameraRef.current.start();
    return () => {
      cameraRef.current?.stop();
      hands.close();
    };
  }, [dims.height, dims.width, emitSparkles, explodeHearts]);

  // animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, dims.width, dims.height);

      // drawing logic
      const trail = trailRef.current;
      if (trail.length > 1) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 26;
        ctx.lineWidth = 7;
        ctx.beginPath();

        for (let i = 1; i < trail.length - 1; i += 1) {
          const xc = (trail[i].x + trail[i + 1].x) / 2;
          const yc = (trail[i].y + trail[i + 1].y) / 2;
          if (i === 1) ctx.moveTo(trail[i].x, trail[i].y);
          ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Sparkle particles
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0.05);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.065;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#00eaff';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Heart particles
      heartsRef.current = heartsRef.current.filter((h) => h.life > 0.03);
      heartsRef.current.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.vy += 0.012;
        h.life -= 0.03;
        ctx.globalAlpha = h.life;
        ctx.font = `${h.s}px serif`;
        ctx.fillText('💖', h.x, h.y);
      });

      // pointer rendering: always-visible fingertip debug pointer while hand is detected.
      if (handRef.current) {
        const indexTip = handRef.current[FINGER_TIP];
        // coordinate flipping for mirrored webcam pointer space.
        const pointerX = (1 - indexTip.x) * dims.width;
        const pointerY = indexTip.y * dims.height;
        const pointerColor = handStateRef.current.isPinching ? '#ff4ecd' : '#00eaff';

        ctx.globalAlpha = 1;
        ctx.shadowColor = pointerColor;
        ctx.shadowBlur = 18;
        ctx.fillStyle = pointerColor;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 2.2;
        ctx.strokeStyle = `${pointerColor}cc`;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [dims.height, dims.width, neonColor]);

  useEffect(() => {
    if (!isRecording || !containerRef.current) {
      mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop();
      return;
    }

    const stream = containerRef.current.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onRecordingReady(URL.createObjectURL(blob));
    };
    recorder.start();

    return () => recorder.state === 'recording' && recorder.stop();
  }, [isRecording, onRecordingReady]);

  return (
    <div className="booth-stage" ref={containerRef}>
      <Webcam ref={webcamRef} mirrored className="webcam" audio={false} videoConstraints={dims} />
      <canvas ref={canvasRef} width={dims.width} height={dims.height} className="fx-canvas" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}
