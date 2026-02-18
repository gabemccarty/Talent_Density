/**
 * 2D canvas "globe": procedural map (graticule), horizontal + vertical rotation, zoom, pins, labels.
 */
function Globe2D(container, options) {
  options = options || {};
  this.locations = options.locations || [];
  this.onPinClick = options.onPinClick || function () {};
  this.onPinHover = options.onPinHover || function () {};
  this.rotationLng = 0;
  this.rotationLat = 0;
  this.zoom = 1;
  this.dragStart = null;
  this.pinHitRadius = 12;

  var canvas = document.createElement('canvas');
  container.innerHTML = '';
  container.appendChild(canvas);
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.resize();
  var self = this;
  window.addEventListener('resize', function () { self.resize(); });

  canvas.addEventListener('mousedown', function (e) { self.onDown(e); });
  canvas.addEventListener('mousemove', function (e) { self.onMove(e); });
  canvas.addEventListener('mouseup', function () { self.onUp(); });
  canvas.addEventListener('mouseleave', function () { self.onUp(); self.onLeave(); });
  canvas.addEventListener('wheel', function (e) { self.onWheel(e); }, { passive: false });
  canvas.addEventListener('click', function (e) { self.onClick(e); });
  this.animate();
}

Globe2D.prototype.resize = function () {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = this.canvas.clientWidth;
  var h = this.canvas.clientHeight;
  this.canvas.width = w * dpr;
  this.canvas.height = h * dpr;
  this.ctx.scale(dpr, dpr);
  this.cx = w / 2;
  this.cy = h / 2;
  this.radius = Math.min(w, h) * 0.38;
};

Globe2D.prototype.latLngToXY = function (lat, lng, out) {
  var phi = (90 - lat) * (Math.PI / 180);
  var theta = (lng + this.rotationLng) * (Math.PI / 180);
  var r = this.radius * this.zoom;
  var x = Math.sin(phi) * Math.sin(theta);
  var y = Math.cos(phi);
  var z = Math.sin(phi) * Math.cos(theta);
  var tilt = this.rotationLat * (Math.PI / 180);
  var y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
  var z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
  out.x = this.cx + r * x;
  out.y = this.cy - r * y2;
  out.visible = z2 > -0.08;
  return out;
};

Globe2D.prototype.drawGraticule = function (ctx, cx, cy, r) {
  var pt = { x: 0, y: 0, visible: false };
  var step = 4;
  var lat, lng;
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  for (lat = -75; lat <= 75; lat += 15) {
    ctx.beginPath();
    for (lng = -180; lng <= 180; lng += step) {
      this.latLngToXY(lat, lng, pt);
      if (pt.visible) ctx.lineTo(pt.x, pt.y);
      else ctx.moveTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
  for (lng = -180; lng < 180; lng += 15) {
    ctx.beginPath();
    for (lat = -90; lat <= 90; lat += step) {
      this.latLngToXY(lat, lng, pt);
      if (pt.visible) ctx.lineTo(pt.x, pt.y);
      else ctx.moveTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.8;
  for (lat = -90; lat <= 90; lat += 90) {
    ctx.beginPath();
    for (lng = -180; lng <= 180; lng += step) {
      this.latLngToXY(lat, lng, pt);
      if (pt.visible) ctx.lineTo(pt.x, pt.y);
      else ctx.moveTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
  for (lng = -180; lng <= 180; lng += 180) {
    ctx.beginPath();
    for (lat = -90; lat <= 90; lat += step) {
      this.latLngToXY(lat, lng, pt);
      if (pt.visible) ctx.lineTo(pt.x, pt.y);
      else ctx.moveTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
};

Globe2D.prototype.drawLand = function (ctx) {
  var pt = { x: 0, y: 0, visible: false };
  var land = typeof WORLD_LAND !== 'undefined' && Array.isArray(WORLD_LAND) ? WORLD_LAND : null;
  if (land && land.length > 0) {
    ctx.fillStyle = 'rgba(34,85,68,0.82)';
    ctx.strokeStyle = 'rgba(28,70,55,0.6)';
    ctx.lineWidth = 0.8;
    for (var p = 0; p < land.length; p++) {
      var ring = land[p];
      if (!ring || ring.length < 3) continue;
      ctx.beginPath();
      var started = false;
      for (var i = 0; i < ring.length; i++) {
        var lng = ring[i][0], lat = ring[i][1];
        this.latLngToXY(lat, lng, pt);
        if (pt.visible) {
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
          else ctx.lineTo(pt.x, pt.y);
        } else {
          started = false;
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  /* Land data is loading (world-land.js) – don't draw blob fallback */
  if (typeof window !== 'undefined' && window.WORLD_LAND_LOADING) return;
  var continents = [
    [50, -100, 28, 22],
    [-15, -58, 20, 16],
    [52, 12, 14, 10],
    [2, 22, 20, 18],
    [45, 100, 25, 22],
    [-22, 132, 14, 12],
    [65, -20, 8, 6],
  ];
  for (var c = 0; c < continents.length; c++) {
    var clat = continents[c][0], clng = continents[c][1], rlat = continents[c][2], rlng = continents[c][3];
    this.latLngToXY(clat, clng, pt);
    if (!pt.visible) continue;
    ctx.beginPath();
    for (var t = 0; t <= 36; t++) {
      var a = (t / 36) * Math.PI * 2;
      var lat = clat + rlat * Math.sin(a);
      var lng = clng + rlng * Math.cos(a);
      this.latLngToXY(lat, lng, pt);
      if (t === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(34,85,68,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,120,90,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
};

Globe2D.prototype.draw = function () {
  var ctx = this.ctx;
  var w = this.canvas.clientWidth;
  var h = this.canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  var r = this.radius * this.zoom;
  var cx = this.cx;
  var cy = this.cy;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  var gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
  gradient.addColorStop(0, '#1a6b8a');
  gradient.addColorStop(0.5, '#0e5070');
  gradient.addColorStop(1, '#063a52');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  this.drawLand(ctx);
  this.drawGraticule(ctx, cx, cy, r);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  var pinPos = { x: 0, y: 0, visible: false };
  this.pinPositions = [];
  var unknownLocation = { lat: 21.3069, lng: -157.8583 };
  for (var i = 0; i < this.locations.length; i++) {
    var loc = this.locations[i];
    if (!loc) continue;
    var lat = loc.lat != null ? Number(loc.lat) : unknownLocation.lat;
    var lng = loc.lng != null ? Number(loc.lng) : unknownLocation.lng;
    if (loc.count === 0) continue;
    this.latLngToXY(lat, lng, pinPos);
    this.pinPositions.push({ x: pinPos.x, y: pinPos.y, location: loc, visible: pinPos.visible });
    if (!pinPos.visible) continue;
    var scale = Math.min(1.5, 0.5 + Math.log10(1 + loc.count) * 0.25);
    var pr = this.pinHitRadius * scale;
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath();
    ctx.arc(pinPos.x, pinPos.y, pr * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var label = (loc.label != null && String(loc.label).trim()) ? String(loc.label) : '';
    if (label) {
      var fontSize = Math.min(16, Math.max(9, 10 + (this.zoom - 1) * 0.6));
      ctx.font = fontSize + 'px "Segoe UI", system-ui, sans-serif';
      var metrics = ctx.measureText(label);
      var tw = metrics.width;
      var th = fontSize + 4;
      var tx = pinPos.x - tw / 2;
      var ty = pinPos.y + pr + 4;
      ctx.fillStyle = 'rgba(13,17,23,0.9)';
      ctx.fillRect(tx - 3, ty - fontSize - 2, tw + 6, th);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx - 3, ty - fontSize - 2, tw + 6, th);
      ctx.fillStyle = '#e6edf3';
      ctx.fillText(label, tx, ty - 4);
    }
  }
};

Globe2D.prototype.animate = function () {
  this.draw();
  var self = this;
  requestAnimationFrame(function () { self.animate(); });
};

Globe2D.prototype.onDown = function (e) {
  this.dragStart = { x: e.clientX, y: e.clientY, startLng: this.rotationLng, startLat: this.rotationLat };
};

Globe2D.prototype.onMove = function (e) {
  if (this.dragStart) {
    this.rotationLng = this.dragStart.startLng + (e.clientX - this.dragStart.x) * 0.22;
    this.rotationLat = Math.max(-85, Math.min(85, this.dragStart.startLat + (e.clientY - this.dragStart.y) * 0.18));
    this.onPinHover(null, null);
    return;
  }
  var loc = this.getPinAt(e.clientX, e.clientY);
  this.onPinHover(loc, e);
};

Globe2D.prototype.onUp = function () {
  this.dragStart = null;
};

Globe2D.prototype.onLeave = function () {
  this.onPinHover(null, null);
};

Globe2D.prototype.onWheel = function (e) {
  e.preventDefault();
  this.zoom = Math.max(0.35, Math.min(24, this.zoom - e.deltaY * 0.002));
};

Globe2D.prototype.getPinAt = function (clientX, clientY) {
  var rect = this.canvas.getBoundingClientRect();
  var x = clientX - rect.left;
  var y = clientY - rect.top;
  var unknownLocation = { lat: 21.3069, lng: -157.8583, label: 'Unknown (Hawaii)' };
  for (var i = 0; i < (this.pinPositions || []).length; i++) {
    var p = this.pinPositions[i];
    if (!p || !p.visible || !p.location) continue;
    var dx = x - p.x;
    var dy = y - p.y;
    var scale = Math.min(1.5, 0.5 + Math.log10(1 + (p.location.count || 0)) * 0.25);
    var hitR = this.pinHitRadius * scale;
    if (dx * dx + dy * dy <= hitR * hitR) {
      return p.location;
    }
  }
  return null;
};

Globe2D.prototype.onClick = function (e) {
  var loc = this.getPinAt(e.clientX, e.clientY);
  if (loc) this.onPinClick(loc);
};
