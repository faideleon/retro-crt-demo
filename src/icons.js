// Shared by the HTML OS and the canvas imitation drawn on the 3D screen,
// so both look identical at the moment of hand-off.

export const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const LAYOUT = {
  menuH: 30,
  iconX: 18,
  iconY: 50,
  iconW: 88,
  iconStep: 94,
  iconSize: 48,
  desktop: '#5e8f8a',
  menu: '#f1e6cf',
  ink: '#2b2420',
  cream: '#f6ecd6',
  coral: '#e8735a',
};

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="96" height="96" shape-rendering="crispEdges">${inner}</svg>`;

const ICONS = {
  about: svg(
    `<rect x="4" y="6" width="24" height="20" fill="#f6ecd6" stroke="#2b2420" stroke-width="2"/>` +
      `<rect x="8" y="10" width="8" height="8" fill="#e8735a"/>` +
      `<rect x="18" y="11" width="7" height="2" fill="#2b2420"/><rect x="18" y="15" width="5" height="2" fill="#2b2420"/>` +
      `<rect x="8" y="20" width="16" height="2" fill="#2b2420"/>`
  ),
  projects: svg(
    `<path d="M3 9h10l2 3h14v15H3z" fill="#e9b949" stroke="#2b2420" stroke-width="2"/>` +
      `<rect x="4" y="14" width="24" height="2" fill="#2b2420" opacity=".25"/>`
  ),
  notes: svg(
    `<path d="M7 3h13l6 6v20H7z" fill="#f6ecd6" stroke="#2b2420" stroke-width="2"/>` +
      `<path d="M20 3v6h6" fill="none" stroke="#2b2420" stroke-width="2"/>` +
      `<rect x="10" y="13" width="12" height="2" fill="#2b2420"/><rect x="10" y="17" width="12" height="2" fill="#2b2420"/>` +
      `<rect x="10" y="21" width="8" height="2" fill="#2b2420"/>`
  ),
  trash: svg(
    `<rect x="8" y="9" width="16" height="19" fill="#cfd8d4" stroke="#2b2420" stroke-width="2"/>` +
      `<rect x="5" y="6" width="22" height="3" fill="#2b2420"/><rect x="13" y="3" width="6" height="3" fill="#2b2420"/>` +
      `<rect x="12" y="13" width="2" height="11" fill="#2b2420"/><rect x="18" y="13" width="2" height="11" fill="#2b2420"/>`
  ),
};

export const ICON_LIST = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'notes', label: 'Notes.txt' },
  { id: 'trash', label: 'Trash' },
];

export const iconURL = (id) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONS[id]);

export const clockText = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
