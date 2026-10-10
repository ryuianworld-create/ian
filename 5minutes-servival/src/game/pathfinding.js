// 미로 셀 그래프 위에서의 간단한 BFS 경로 탐색. AI 친구/졸라맨이 모퉁이를
// 자연스럽게 돌아가도록 셀 중심 웨이포인트 목록을 만들어 준다.
export function bfsPath(cells, mazeW, mazeH, from, to) {
  const key = (x, y) => `${x},${y}`;
  if (from.cellX === to.cellX && from.cellY === to.cellY) return [from];

  const visited = new Set([key(from.cellX, from.cellY)]);
  const prev = new Map();
  const queue = [from];
  let qi = 0;
  let reached = false;

  while (qi < queue.length) {
    const cur = queue[qi++];
    if (cur.cellX === to.cellX && cur.cellY === to.cellY) {
      reached = true;
      break;
    }
    const cell = cells[cur.cellY][cur.cellX];
    const neighbors = [];
    if (!cell.N) neighbors.push({ cellX: cur.cellX, cellY: cur.cellY - 1 });
    if (!cell.S) neighbors.push({ cellX: cur.cellX, cellY: cur.cellY + 1 });
    if (!cell.E) neighbors.push({ cellX: cur.cellX + 1, cellY: cur.cellY });
    if (!cell.W) neighbors.push({ cellX: cur.cellX - 1, cellY: cur.cellY });
    for (const n of neighbors) {
      if (n.cellX < 0 || n.cellX >= mazeW || n.cellY < 0 || n.cellY >= mazeH) continue;
      const k = key(n.cellX, n.cellY);
      if (visited.has(k)) continue;
      visited.add(k);
      prev.set(k, cur);
      queue.push(n);
    }
  }

  if (!reached && !visited.has(key(to.cellX, to.cellY))) return [from];

  const path = [];
  let cur = to;
  while (true) {
    path.push(cur);
    const k = key(cur.cellX, cur.cellY);
    if (k === key(from.cellX, from.cellY)) break;
    const p = prev.get(k);
    if (!p) break;
    cur = p;
  }
  path.reverse();
  return path;
}
