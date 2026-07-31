/**
 * DOM 껍데기 — 사운드/CRT 설정 버튼과 캔버스 크기 맞춤.
 *
 * 캔버스 백버퍼는 224×256 고정이고 여기서는 CSS 표시 크기만 만진다.
 * 즉 창 크기를 아무리 바꿔도 게임 좌표와 충돌 판정은 전혀 영향받지 않는다.
 */

import { storage } from './storage.js';

export function setupUi({ audio, onCrtChange }) {
  const el = (id) => document.getElementById(id);
  const screen = el('screen');
  const btnMute = el('btn-mute');
  const volume = el('volume');
  const crt = el('crt-toggle');

  const applyMuteLabel = () => {
    if (!btnMute) return;
    btnMute.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    btnMute.setAttribute('aria-pressed', String(audio.muted));
  };

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      audio.unlock();
      audio.toggleMute();
      applyMuteLabel();
      if (!audio.muted) audio.blip();
    });
  }
  applyMuteLabel();

  if (volume) {
    volume.value = String(Math.round(audio.volume * 100));
    volume.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(Number(volume.value) / 100);
    });
    volume.addEventListener('change', () => {
      if (!audio.muted) audio.blip();
    });
  }

  const applyCrt = (on) => {
    if (screen) screen.classList.toggle('crt', on);
    storage.setCrt(on);
    if (onCrtChange) onCrtChange(on);
  };
  if (crt) {
    crt.checked = storage.getCrt();
    applyCrt(crt.checked);
    crt.addEventListener('change', () => applyCrt(crt.checked));
  } else {
    applyCrt(storage.getCrt());
  }

  return { applyMuteLabel };
}
