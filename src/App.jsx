import { useMemo, useState } from 'react';
import PhotoBooth from './components/PhotoBooth';
import { FaTrashAlt, FaVideo, FaCircle } from 'react-icons/fa';

const NEON_COLORS = ['#ff4ecd', '#00eaff', '#9b5cff', '#c8ff4e'];

export default function App() {
  const [color, setColor] = useState(NEON_COLORS[0]);
  const [clearToken, setClearToken] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);

  const stickers = useMemo(
    () => ['✨', '💖', '🫧', '🌈', '💿', '⭐'],
    []
  );

  return (
    <div className="app-shell">
      <PhotoBooth
        neonColor={color}
        clearToken={clearToken}
        isRecording={isRecording}
        onRecordingReady={(url) => setRecordings((prev) => [url, ...prev].slice(0, 3))}
      />

      <div className="sticker-layer" aria-hidden>
        {stickers.map((sticker, i) => (
          <span
            key={sticker + i}
            className="sticker"
            style={{ '--delay': `${i * 0.7}s`, '--x': `${8 + i * 15}%` }}
          >
            {sticker}
          </span>
        ))}
      </div>

      <div className="control-panel">
        <div className="swatches">
          {NEON_COLORS.map((swatch) => (
            <button
              key={swatch}
              className={`swatch ${color === swatch ? 'active' : ''}`}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
              aria-label={`Set drawing color ${swatch}`}
            />
          ))}
        </div>

        <div className="actions">
          <button className="bubble-btn" onClick={() => setClearToken((v) => v + 1)}>
            <FaTrashAlt />
          </button>
          <button
            className={`bubble-btn record ${isRecording ? 'live' : ''}`}
            onClick={() => setIsRecording((v) => !v)}
          >
            {isRecording ? <FaCircle /> : <FaVideo />}
          </button>
        </div>
      </div>

      {recordings.length > 0 && (
        <div className="recording-strip">
          {recordings.map((url, index) => (
            <video key={url + index} src={url} controls muted loop />
          ))}
        </div>
      )}
    </div>
  );
}
