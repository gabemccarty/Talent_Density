/**
 * World land outline for globe2d.js.
 * WORLD_LAND = array of rings; each ring = array of [lng, lat].
 * Tries to load from CDN; falls back to embedded simplified outline so map always works.
 */
(function () {
  function geoToRings(geojson) {
    var rings = [];
    var features = geojson.features || [];
    for (var f = 0; f < features.length; f++) {
      var geom = features[f].geometry;
      if (!geom || !geom.coordinates) continue;
      var coords = geom.coordinates;
      if (geom.type === 'Polygon') {
        for (var c = 0; c < coords.length; c++) rings.push(coords[c]);
      } else if (geom.type === 'MultiPolygon') {
        for (var p = 0; p < coords.length; p++) {
          for (var c = 0; c < coords[p].length; c++) rings.push(coords[p][c]);
        }
      }
    }
    return rings;
  }

  /* Embedded fallback when CDN fails: minimal closed rings [lng,lat] */
  var embedded = [
    [[-180,-60],[-120,-75],[-60,-55],[-40,-20],[-80,30],[-125,50],[-70,50],[-55,50],[-180,70],[180,70],[180,-60],[-180,-60]],
    [[-10,35],[5,51],[30,46],[25,32],[0,36],[-18,15],[-12,-35],[35,-5],[15,50],[-10,35]],
    [[25,42],[70,42],[100,22],[130,5],[145,50],[180,65],[180,75],[-180,75],[-180,70],[-65,55],[-55,50],[-70,50],[-30,70],[25,72],[25,42]],
    [[113,-26],[145,-28],[154,-38],[130,-32],[113,-26]],
    [[-45,60],[-30,75],[-30,83],[-45,75],[-45,60]],
    [[-10,50],[0,59],[0,52],[-10,50]],
    [[130,32],[142,45],[140,35],[130,32]],
    [[43,-12],[50,-26],[43,-12]],
    [[166,-34],[178,-47],[166,-47],[166,-34]],
    [[95,-6],[141,-2],[140,-20],[95,-6]],
    [[-24,63],[-15,66],[-24,63]],
  ];

  window.WORLD_LAND_LOADING = true;
  /* Load from same origin (no CDN = no 404) */
  var url = 'js/ne_110m_land.json';
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (geojson) {
      window.WORLD_LAND = geoToRings(geojson);
    })
    .catch(function () {
      window.WORLD_LAND = embedded;
    })
    .then(function () {
      window.WORLD_LAND_LOADING = false;
    });
})();
