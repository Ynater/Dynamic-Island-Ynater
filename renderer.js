const eyes = document.querySelectorAll('.eye');
const island = document.getElementById('island');

document.addEventListener('mousemove', e => {
  eyes.forEach(eye => {
    const r = eye.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx);
    const d = Math.min(3, Math.hypot(e.clientX - cx, e.clientY - cy));
    const p = eye.querySelector('.pupil');
    p.style.transform = 'translate(' + (Math.cos(a)*d) + 'px,' + (Math.sin(a)*d) + 'px)';
  });

  const rect = island.getBoundingClientRect();
  const ix = rect.left + rect.width / 2;
  const iy = rect.top + rect.height / 2;
  const dist = Math.hypot(e.clientX - ix, e.clientY - iy);
  
  if (dist < 180) {
    island.classList.add('nearby');
  } else {
    island.classList.remove('nearby');
  }
});

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
  });
});

function updateClock() {
  const n = new Date();
  const h = String(n.getHours()).padStart(2, '0');
  const m = String(n.getMinutes()).padStart(2, '0');
  const el = document.getElementById('clock');
  if (el) el.textContent = h + ':' + m;
}
setInterval(updateClock, 1000);
updateClock();

setInterval(() => {
  document.querySelectorAll('.eye').forEach(eye => {
    eye.style.transform = 'scaleY(0.1)';
    setTimeout(() => eye.style.transform = 'scaleY(1)', 120);
  });
}, 4000);