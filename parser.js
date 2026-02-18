/**
 * Browser-safe parser: CSV -> employees -> locations with departments.
 * Exposes window.TalentMapParser.processCSV(csvText, companyFilter).
 */
(function (global) {
  /** Fallback for null/unknown location: show on Hawaii so we never have null lat/lng. */
  const UNKNOWN_LOCATION = { lat: 21.3069, lng: -157.8583, label: 'Unknown (Hawaii)' };

  const cityCoordinates = {
    'san francisco': [37.7749, -122.4194], 'san francisco bay area': [37.7749, -122.4194],
    'sf bay area': [37.7749, -122.4194], 'bay area': [37.7749, -122.4194],
    'menlo park': [37.4529, -122.1817], 'sunnyvale': [37.3688, -122.0363],
    'mountain view': [37.3861, -122.0839], 'palo alto': [37.4419, -122.1430],
    'cupertino': [37.3230, -122.0322], 'santa clara': [37.3541, -122.0488],
    'san jose': [37.3382, -122.8863], 'oakland': [37.8044, -122.2712],
    'fremont': [37.5485, -121.9886], 'berkeley': [37.8715, -122.2730], 'milpitas': [37.4323, -121.8996],
    'ann arbor': [42.2808, -83.7430], 'california': [36.7783, -119.4179],
    'new york': [40.7128, -74.0060], 'new york city': [40.7128, -74.0060], 'nyc': [40.7128, -74.0060],
    'brooklyn': [40.6782, -73.9442], 'seattle': [47.6062, -122.3321], 'bellevue': [47.6101, -122.2015],
    'redmond': [47.6740, -122.1215], 'los angeles': [34.0522, -118.2437], 'la': [34.0522, -118.2437],
    'san diego': [32.7157, -117.1611], 'austin': [30.2672, -97.7431], 'denver': [39.7392, -104.9903],
    'boston': [42.3601, -72.0589], 'cambridge': [42.3736, -71.1097], 'chicago': [41.8781, -87.6298],
    'washington': [38.9072, -77.0369], 'washington dc': [38.9072, -77.0369], 'dc': [38.9072, -77.0369],
    'atlanta': [33.7490, -84.3880], 'miami': [25.7617, -80.1918], 'dallas': [32.7767, -96.7970],
    'houston': [29.7604, -95.3698], 'phoenix': [33.4484, -112.0740], 'philadelphia': [39.9526, -75.1652],
    'portland': [45.5152, -122.6784], 'salt lake city': [40.7608, -111.8910],
    'london': [51.5074, -0.1278], 'greater london': [51.5074, -0.1278],
    'dublin': [53.3498, -6.2603], 'amsterdam': [52.3676, 4.9041], 'berlin': [52.5200, 13.4050],
    'munich': [48.1351, 11.5820], 'paris': [48.8566, 2.3522], 'zurich': [47.3769, 8.5417],
    'tel aviv': [32.0853, 34.7818], 'singapore': [1.3521, 103.8198], 'tokyo': [35.6762, 139.6503],
    'sydney': [-33.8688, 151.2093], 'toronto': [43.6532, -79.3832], 'vancouver': [49.2827, -123.1207],
    'montreal': [45.5017, -73.5673], 'bangalore': [12.9716, 77.5946], 'bengaluru': [12.9716, 77.5946],
    'hyderabad': [17.3850, 78.4867], 'mumbai': [19.0760, 72.8777], 'remote': [20, 0],
    'united states': [39.8283, -98.5795], 'usa': [39.8283, -98.5795], 'united kingdom': [55.3781, -3.4360],
    'uk': [55.3781, -3.4360], 'canada': [56.1304, -106.3468], 'germany': [51.1657, 10.4515],
    'india': [20.5937, 78.9629], 'china': [35.8617, 104.1954], 'shanghai': [31.2304, 121.4737],
    'beijing': [39.9042, 116.4074], 'hong kong': [22.3193, 114.1694], 'hong kong sar': [22.3193, 114.1694],
  };

  function resolveLocation(location) {
    if (!location || typeof location !== 'string') return null;
    const raw = location.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const parts = lower.split(/[\s,;|]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join(' ');
      if (cityCoordinates[key]) {
        const c = cityCoordinates[key];
        return { lat: c[0], lng: c[1], label: raw, cityKey: key };
      }
    }
    if (cityCoordinates[parts[0]]) {
      const c = cityCoordinates[parts[0]];
      return { lat: c[0], lng: c[1], label: raw, cityKey: parts[0] };
    }
    return null;
  }

  /** Geographic regions: cities in the same region become one pin (e.g. SF Bay Area). */
  const GEO_REGIONS = [
    { id: 'sf_bay_area', label: 'SF Bay Area', lat: 37.7749, lng: -122.4194, cityKeys: ['san francisco', 'san francisco bay area', 'sf bay area', 'bay area', 'oakland', 'san jose', 'berkeley', 'fremont', 'milpitas', 'palo alto', 'mountain view', 'sunnyvale', 'cupertino', 'santa clara', 'menlo park'] },
    { id: 'greater_nyc', label: 'New York Metro', lat: 40.7128, lng: -74.0060, cityKeys: ['new york', 'new york city', 'nyc', 'brooklyn'] },
    { id: 'greater_seattle', label: 'Seattle Metro', lat: 47.6062, lng: -122.3321, cityKeys: ['seattle', 'bellevue', 'redmond'] },
    { id: 'greater_la', label: 'Greater Los Angeles', lat: 34.0522, lng: -118.2437, cityKeys: ['los angeles', 'la'] },
    { id: 'greater_boston', label: 'Greater Boston', lat: 42.3601, lng: -71.0589, cityKeys: ['boston', 'cambridge'] },
    { id: 'greater_london', label: 'Greater London', lat: 51.5074, lng: -0.1278, cityKeys: ['london', 'greater london'] },
  ];
  function getRegionForCityKey(cityKey) {
    if (!cityKey) return null;
    const k = String(cityKey).toLowerCase();
    for (let i = 0; i < GEO_REGIONS.length; i++) {
      if (GEO_REGIONS[i].cityKeys.indexOf(k) !== -1) return GEO_REGIONS[i];
    }
    return null;
  }

  const TIER_PATTERNS = [
    { tier: 0, patterns: [/ceo\b/i, /chief executive/i, /\bpresident\b/i] },
    { tier: 1, patterns: [/cto\b/i, /cfo\b/i, /coo\b/i, /cmo\b/i, /chief\s+\w+\s+officer/i] },
    { tier: 2, patterns: [/senior\s+director/i, /sr\.?\s+director/i] },
    { tier: 3, patterns: [/\bdirector\b/i, /head\s+of\s+/i] },
    { tier: 4, patterns: [/senior\s+manager/i, /manager\s+ii/i, /engineering\s+leader/i] },
    { tier: 5, patterns: [/\bmanager\b/i, /tech\s+lead\s+manager/i, /\btlm\b/i, /team\s+lead/i] },
    { tier: 6, patterns: [/tech\s+lead/i, /principal\s+engineer/i, /principal\s+ic/i] },
    { tier: 7, patterns: [/staff\s+engineer/i, /staff\s+scientist/i, /senior\s+staff/i] },
    { tier: 8, patterns: [/senior\s+engineer/i, /senior\s+\w+/i, /sr\.?\s+engineer/i] },
    { tier: 9, patterns: [/engineer/i, /scientist/i, /designer/i, /analyst/i] },
  ];

  const tierLevelNames = {
    0: 'Top Executive', 1: 'C-Suite Leadership', 2: 'Senior Directors',
    3: 'Directors & Heads', 4: 'Senior Managers', 5: 'Managers & Team Leads',
    6: 'Tech Leads & Principal ICs', 7: 'Staff Engineers', 8: 'Senior Engineers', 9: 'Engineers',
  };

  function inferTier(title) {
    if (!title || typeof title !== 'string') return 9;
    const t = title.trim();
    for (let i = 0; i < TIER_PATTERNS.length; i++) {
      const tierPattern = TIER_PATTERNS[i];
      for (let j = 0; j < tierPattern.patterns.length; j++) {
        if (tierPattern.patterns[j].test(t)) return tierPattern.tier;
      }
    }
    return 9;
  }

  const DEPARTMENT_KEYWORDS = [
    { dept: 'AI & Machine Learning', keywords: ['machine learning', 'ml ', ' ml', 'applied scientist'] },
    { dept: 'Perception', keywords: ['perception'] },
    { dept: 'Motion Planning', keywords: ['planning', 'planner', 'prediction'] },
    { dept: 'Simulation', keywords: ['simulation', ' sim '] },
    { dept: 'Software Engineering', keywords: ['software engineer'] },
    { dept: 'Systems Engineering', keywords: ['system engineer', 'systems engineer'] },
    { dept: 'Hardware Engineering', keywords: ['hardware'] },
    { dept: 'Infrastructure & Platform', keywords: ['infrastructure', 'platform', 'cloud'] },
    { dept: 'Data Engineering', keywords: ['data engineer', 'data platform'] },
    { dept: 'Product Management', keywords: ['product manager', 'product management'] },
    { dept: 'Product Design', keywords: ['product design', ' ux ', ' ui '] },
    { dept: 'Technical Program Management', keywords: ['program manager', ' tpm ', 'technical program'] },
    { dept: 'Safety', keywords: ['safety'] },
    { dept: 'Test & Validation', keywords: ['test', 'validation', 'sdet', ' qa '] },
    { dept: 'Fleet Operations', keywords: ['fleet', 'operations'] },
  ];

  const departmentColors = {
    'AI & Machine Learning': '#3498DB', 'Perception': '#3498DB', 'Motion Planning': '#3498DB',
    'Simulation': '#16A085', 'Software Engineering': '#27AE60', 'Systems Engineering': '#E67E22',
    'Hardware Engineering': '#9B59B6', 'Infrastructure & Platform': '#7F8C8D',
    'Data Engineering': '#27AE60', 'Product Management': '#E91E63', 'Product Design': '#E91E63',
    'Technical Program Management': '#E91E63', 'Safety': '#F39C12', 'Test & Validation': '#F39C12',
    'Fleet Operations': '#7F8C8D', 'Other': '#95A5A6',
  };

  function inferDepartment(title) {
    if (!title || typeof title !== 'string') return 'Other';
    const t = title.toLowerCase();
    for (let i = 0; i < DEPARTMENT_KEYWORDS.length; i++) {
      const d = DEPARTMENT_KEYWORDS[i];
      for (let j = 0; j < d.keywords.length; j++) {
        if (t.indexOf(d.keywords[j].toLowerCase()) !== -1) return d.dept;
      }
    }
    return 'Other';
  }

  function parseRow(line, sep) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (inQuotes) cur += ch;
      else if (ch === sep) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    const header = lines[0];
    const sep = header.indexOf('\t') !== -1 ? '\t' : ',';
    const cols = parseRow(header, sep);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i], sep);
      const row = {};
      for (let j = 0; j < cols.length; j++) row[cols[j]] = cells[j] != null ? String(cells[j]).trim() : '';
      rows.push(row);
    }
    return rows;
  }

  function normalizeColumnName(name) {
    return (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function findColumn(row, candidates) {
    const keys = Object.keys(row);
    const normalized = {};
    for (let i = 0; i < keys.length; i++) normalized[normalizeColumnName(keys[i])] = keys[i];
    for (let i = 0; i < candidates.length; i++) {
      const n = normalizeColumnName(candidates[i]);
      if (normalized[n]) return row[normalized[n]];
    }
    return '';
  }

  /** Normalize to canonical https://www.linkedin.com/in/{slug} to avoid 404s from non-www or malformed URLs */
  function normalizeLinkedInUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var s = String(url).replace(/^["']|["']$/g, '').trim();
    if (!s) return '';
    // Match linkedin.com/in/slug (slug may contain letters, numbers, hyphen, underscore, period)
    var match = s.match(/linkedin\.com\/in\/([a-zA-Z0-9_.-]+)/i);
    if (match && match[1]) return 'https://www.linkedin.com/in/' + match[1];
    // Fallback: take path after /in/ and drop query/fragment
    var slug = s.replace(/^.*\/in\/?/i, '').replace(/[\?#].*$/, '').replace(/\/.*$/, '').replace(/^\/+|\/+$/g, '').trim();
    if (slug) return 'https://www.linkedin.com/in/' + slug;
    return '';
  }

  function getEmployeeFromRow(row, companyFilter) {
    const company = findColumn(row, ['Company', 'Current Company', 'Employer', 'Organization']);
    if (companyFilter && company && company.toLowerCase().indexOf(companyFilter.toLowerCase()) === -1) return null;
    const first = findColumn(row, ['First Name', 'FirstName', 'First']);
    const last = findColumn(row, ['Last Name', 'LastName', 'Last']);
    const name = (first && last ? first + ' ' + last : '') || findColumn(row, ['Name', 'Full Name']) || 'Unknown';
    const title = findColumn(row, ['Title', 'Job Title', 'Position', 'Current Title']) || '';
    const location = findColumn(row, ['Location', 'Office', 'City', 'Geography']) || '';
    const linkedinRaw = findColumn(row, ['LinkedIn', 'LinkedIn URL', 'Profile URL']) || '';
    const linkedin = normalizeLinkedInUrl(linkedinRaw);
    return { name: name, title: title, location: location, linkedin: linkedin, company: company };
  }

  function buildLocationKey(resolved) {
    if (!resolved || resolved.label === 'Remote') return UNKNOWN_LOCATION.label + '|' + UNKNOWN_LOCATION.lat.toFixed(2) + '|' + UNKNOWN_LOCATION.lng.toFixed(2);
    var lat = resolved.lat != null ? Number(resolved.lat) : UNKNOWN_LOCATION.lat;
    var lng = resolved.lng != null ? Number(resolved.lng) : UNKNOWN_LOCATION.lng;
    return (resolved.label || UNKNOWN_LOCATION.label) + '|' + lat.toFixed(2) + '|' + lng.toFixed(2);
  }

  function buildByLocation(employees) {
    const byLocation = {};
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const resolved = resolveLocation(emp.location);
      const fallback = { lat: UNKNOWN_LOCATION.lat, lng: UNKNOWN_LOCATION.lng, label: (emp.location && emp.location.trim()) ? emp.location + ' (Hawaii)' : UNKNOWN_LOCATION.label };
      const resolvedOrFallback = resolved || fallback;
      const region = (resolved && resolved.cityKey) ? getRegionForCityKey(resolved.cityKey) : null;
      const key = region ? ('region:' + region.id) : buildLocationKey(resolvedOrFallback);
      if (!byLocation[key]) {
        byLocation[key] = {
          label: region ? region.label : ((resolved && resolved.label) || (emp.location && emp.location.trim()) || UNKNOWN_LOCATION.label),
          lat: region ? region.lat : ((resolved && resolved.lat != null) ? Number(resolved.lat) : UNKNOWN_LOCATION.lat),
          lng: region ? region.lng : ((resolved && resolved.lng != null) ? Number(resolved.lng) : UNKNOWN_LOCATION.lng),
          employees: [],
        };
      }
      byLocation[key].employees.push(emp);
    }
    return byLocation;
  }

  function buildDepartmentsForEmployees(employees) {
    const depts = {};
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const dept = inferDepartment(emp.title);
      const tier = inferTier(emp.title);
      if (!depts[dept]) depts[dept] = { total: 0, hierarchy: {} };
      const tierStr = String(tier);
      if (!depts[dept].hierarchy[tierStr]) depts[dept].hierarchy[tierStr] = { level: tierLevelNames[tier], employees: [] };
      depts[dept].hierarchy[tierStr].employees.push({ name: emp.name, title: emp.title, location: emp.location, linkedin: emp.linkedin, company: emp.company });
      depts[dept].total++;
    }
    const tierOrder = ['0','1','2','3','4','5','6','7','8','9'];
    const deptNames = Object.keys(depts);
    for (let d = 0; d < deptNames.length; d++) {
      const sorted = {};
      for (let t = 0; t < tierOrder.length; t++) if (depts[deptNames[d]].hierarchy[tierOrder[t]]) sorted[tierOrder[t]] = depts[deptNames[d]].hierarchy[tierOrder[t]];
      depts[deptNames[d]].hierarchy = sorted;
    }
    return depts;
  }

  /** Sort employees by tier (senior first) for "top profiles" display. */
  function sortEmployeesByTier(employees) {
    return employees.slice().sort(function (a, b) {
      return inferTier(a.title) - inferTier(b.title);
    });
  }

  function processCSV(csvText, companyFilter) {
    const rows = parseCSV(csvText);
    const employees = [];
    for (let i = 0; i < rows.length; i++) {
      const emp = getEmployeeFromRow(rows[i], companyFilter);
      if (emp && emp.name && emp.name !== 'Unknown') employees.push(emp);
    }
    return buildResultFromEmployees(employees, companyFilter);
  }

  /** Build locations + metadata from a single employees array (shared by processCSV and processMultipleCSVs). */
  function buildResultFromEmployees(employees, companyFilter) {
    const byLocation = buildByLocation(employees);
    const locationKeys = Object.keys(byLocation);
    const locations = [];
    for (let i = 0; i < locationKeys.length; i++) {
      const key = locationKeys[i];
      const data = byLocation[key];
      if (!data || !data.employees) continue;
      var lat = (data.lat != null && Number(data.lat) === data.lat) ? data.lat : UNKNOWN_LOCATION.lat;
      var lng = (data.lng != null && Number(data.lng) === data.lng) ? data.lng : UNKNOWN_LOCATION.lng;
      var sortedEmployees = sortEmployeesByTier(data.employees);
      locations.push({
        key: key,
        label: (data.label != null && data.label !== '') ? data.label : UNKNOWN_LOCATION.label,
        lat: lat,
        lng: lng,
        count: data.employees.length,
        employees: sortedEmployees,
        departments: buildDepartmentsForEmployees(data.employees),
      });
    }
    locations.sort(function (a, b) { return b.count - a.count; });
    return {
      companyName: companyFilter || 'Aggregated',
      totalEmployees: employees.length,
      locations: locations,
      tierLevelNames: tierLevelNames,
      departmentColors: departmentColors,
    };
  }

  /** Accept multiple CSV strings; merge all employees then aggregate by location, company, and engineering type. */
  function processMultipleCSVs(csvTexts, companyFilter) {
    var allEmployees = [];
    for (var i = 0; i < csvTexts.length; i++) {
      var rows = parseCSV(csvTexts[i]);
      for (var r = 0; r < rows.length; r++) {
        var emp = getEmployeeFromRow(rows[r], companyFilter || undefined);
        if (emp && emp.name && emp.name !== 'Unknown') allEmployees.push(emp);
      }
    }
    return buildResultFromEmployees(allEmployees, companyFilter || 'Aggregated');
  }

  global.TalentMapParser = {
    processCSV: processCSV,
    processMultipleCSVs: processMultipleCSVs,
    tierLevelNames: tierLevelNames,
    departmentColors: departmentColors,
  };
})(typeof window !== 'undefined' ? window : this);
