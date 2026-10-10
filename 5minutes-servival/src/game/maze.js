// 재귀 백트래커 방식의 미로 생성기.
// grid[y][x] 셀은 N/E/S/W 네 방향에 벽이 있는지를 boolean으로 갖는다.

export function generateMaze(width, height, rng = Math.random) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ N: true, E: true, S: true, W: true, visited: false, x, y });
    }
    cells.push(row);
  }

  const DIRS = [
    { dx: 0, dy: -1, self: "N", opp: "S" },
    { dx: 1, dy: 0, self: "E", opp: "W" },
    { dx: 0, dy: 1, self: "S", opp: "N" },
    { dx: -1, dy: 0, self: "W", opp: "E" },
  ];

  const stack = [];
  const start = cells[0][0];
  start.visited = true;
  stack.push(start);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = [];
    for (const d of DIRS) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const n = cells[ny][nx];
        if (!n.visited) neighbors.push({ n, d });
      }
    }
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const { n, d } = neighbors[Math.floor(rng() * neighbors.length)];
    current[d.self] = false;
    n[d.opp] = false;
    n.visited = true;
    stack.push(n);
  }

  // 미로가 너무 나무구조(dead-end 과다)로만 되면 답답하니, 벽 일부를 추가로 제거해
  // 순환 경로(루프)를 만들어 준다 - 추격전에 필요한 여러 경로 확보.
  const extraOpenings = Math.floor((width * height) / 6);
  for (let i = 0; i < extraOpenings; i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const d = DIRS[Math.floor(rng() * DIRS.length)];
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      cells[y][x][d.self] = false;
      cells[ny][nx][d.opp] = false;
    }
  }

  return cells;
}
