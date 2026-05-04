import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const FINGER_TIP = 8;
const THUMB_TIP = 4;
const WRIST = 0;

export default function PhotoBooth({ neonColor, clearToken, isRecording, onRecordingReady }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef();
  const cameraRef = useRef();
  const mediaRecorderRef = useRef();

  const [trail, setTrail] = useState([]);
  const particlesRef = useRef([]);
  const heartsRef = useRef([]);
  const handRef = useRef(null);
  const pinchRef = useRef(false);
  const heartCooldown = useRef(0);

  const dims = useMemo(() => ({ width: 1280, height: 720 }), []);

  const emitSparkles = useCallback((x, y) => {
    for (let i = 0; i < 3; i += 1) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 35,
        y: y + (Math.random() - 0.5) * 35,
        r: 2 + Math.random() * 4,
        life: 1,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 1.6,
      });
    }
  }, []);

  const explodeHearts = useCallback((x, y) => {
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      heartsRef.current.push({
        x,
        y,
        life: 1,
        vx: Math.cos(angle) * (2 + Math.random() * 1.5),
        vy: Math.sin(angle) * (2 + Math.random() * 1.5),
        s: 10 + Math.random() * 10,
      });
    }
  }, []);

  useEffect(() => {
    setTrail([]);
  }, [clearToken]);

  useEffect(() => {
    if (!webcamRef.current?.video) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    // gesture detection
    hands.onResults((results) => {
      if (!results.multiHandLandmarks?.length) {
        handRef.current = null;
        pinchRef.current = false;
        return;
      }

      const hand = results.multiHandLandmarks[0];
      handRef.current = hand;
      const indexTip = hand[FINGER_TIP];
      const thumbTip = hand[THUMB_TIP];
      const wrist = hand[WRIST];

      const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      pinchRef.current = pinchDistance < 0.05;

      const raised = wrist.y > 0.45 && indexTip.y < 0.35;
      if (raised) emitSparkles(indexTip.x * dims.width, indexTip.y * dims.height);

      const isHeartPose = pinchDistance < 0.035 && Math.abs(indexTip.y - thumbTip.y) < 0.02;
      const now = performance.now();
      if (isHeartPose && now - heartCooldown.current > 1200) {
        heartCooldown.current = now;
        explodeHearts(indexTip.x * dims.width, indexTip.y * dims.height);
      }

      if (pinchRef.current) {
        setTrail((prev) => [
          ...prev.slice(-60),
          {
            x: indexTip.x * dims.width,
            y: indexTip.y * dims.height,
            t: performance.now(),
          },
        ]);
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
      if (trail.length > 1) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 28;
        ctx.lineWidth = 8;
        ctx.beginPath();

        for (let i = 1; i < trail.length - 1; i += 1) {
          const xc = (trail[i].x + trail[i + 1].x) / 2;
          const yc = (trail[i].y + trail[i + 1].y) / 2;
          if (i === 1) ctx.moveTo(trail[i].x, trail[i].y);
          ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc);
        }

        ctx.stroke();
        ctx.restore();

        trail.forEach((point, idx) => {
          const alpha = idx / trail.length;
          ctx.fillStyle = `${neonColor}${Math.floor(alpha * 90)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2 + alpha * 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      particlesRef.current = particlesRef.current.filter((p) => p.life > 0.05);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#fff0ff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      heartsRef.current = heartsRef.current.filter((h) => h.life > 0.03);
      heartsRef.current.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.vy += 0.02;
        h.life -= 0.02;
        ctx.globalAlpha = h.life;
        ctx.font = `${h.s}px serif`;
        ctx.fillText('💖', h.x, h.y);
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [dims.height, dims.width, neonColor, trail]);

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
